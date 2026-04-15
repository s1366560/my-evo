import { PrismaClient, Prisma } from '@prisma/client';
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';
import type {
  HallucinationCheck,
  TrustAnchor,
  MemoryGraphNode,
  MemoryGraphEdge,
  CapabilityChain,
} from '@prisma/client';
import { NotFoundError, ValidationError } from '../shared/errors';

let prisma = new PrismaClient();

type AlertLevel = 'L1' | 'L2' | 'L3' | 'L4';

interface HallucinationAlertRecord {
  type: string;
  level: AlertLevel;
  message: string;
  suggestion: string | null;
  line: number | null;
  confidence: number;
}

interface ValidationResultRecord {
  type: string;
  passed: boolean;
  message: string;
}

interface ValidationCommandSpec {
  command: string;
  args: string[];
}

interface ForbiddenPatternDefinition {
  id: string;
  category: string;
  description: string;
  suggestion: string;
  pattern: RegExp | string;
}

const FORBIDDEN_PATTERNS: readonly ForbiddenPatternDefinition[] = [
  {
    id: 'eval-exec',
    category: 'security',
    description: 'Dynamic code execution via eval(',
    suggestion: 'Remove dynamic evaluation and use explicit control flow.',
    pattern: 'eval(',
  },
  {
    id: 'exec-call',
    category: 'security',
    description: 'Command execution via exec(',
    suggestion: 'Replace raw exec with allowlisted subprocess execution.',
    pattern: 'exec(',
  },
  {
    id: 'os-system',
    category: 'security',
    description: 'System command execution via os.system(',
    suggestion: 'Avoid shell execution or use a safer, structured API.',
    pattern: 'os.system(',
  },
  {
    id: 'shell-true',
    category: 'security',
    description: 'Subprocess execution with shell=True',
    suggestion: 'Use shell=False and pass arguments as an array.',
    pattern: 'shell=True',
  },
  {
    id: 'dynamic-import',
    category: 'security',
    description: 'Dynamic import via __import__(',
    suggestion: 'Use explicit imports from trusted modules only.',
    pattern: '__import__(',
  },
  {
    id: 'pickle-usage',
    category: 'security',
    description: 'Potentially unsafe deserialization via pickle',
    suggestion: 'Replace pickle with a safer serialization format.',
    pattern: 'pickle.',
  },
  {
    id: 'yaml-load',
    category: 'security',
    description: 'Unsafe YAML loading via yaml.load(',
    suggestion: 'Use yaml.safe_load() instead of yaml.load().',
    pattern: 'yaml.load(',
  },
  {
    id: 'hardcoded-password',
    category: 'security',
    description: 'Hardcoded password detected',
    suggestion: 'Move the password to environment variables or a secrets manager.',
    pattern: /password\s*=\s*['"]/i,
  },
  {
    id: 'hardcoded-key',
    category: 'security',
    description: 'Hardcoded key detected',
    suggestion: 'Move the key to environment variables or a secrets manager.',
    pattern: /key\s*=\s*['"]/i,
  },
  {
    id: 'hardcoded-secret',
    category: 'security',
    description: 'Hardcoded secret detected',
    suggestion: 'Move the secret to environment variables or a secrets manager.',
    pattern: /secret\s*=\s*['"]/i,
  },
] as const;

const KNOWN_VALID_APIS: Record<string, string[]> = {
  requests: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'session'],
  json: ['dumps', 'loads', 'dump', 'load'],
  os: ['path', 'getcwd', 'listdir', 'makedirs', 'remove', 'rename', 'environ'],
  subprocess: ['run', 'Popen', 'PIPE', 'check_output', 'call'],
  http: ['client', 'server', 'HTTPConnection', 'HTTPSConnection'],
  collections: ['defaultdict', 'OrderedDict', 'Counter', 'deque', 'namedtuple'],
};

const CONFIDENCE_DECAY_LAMBDA = 0.023;
const CONFIDENCE_POSITIVE_WEIGHT = 0.05;
const CONFIDENCE_NEGATIVE_WEIGHT = 0.15;

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function splitLines(codeContent: string): string[] {
  return codeContent.split('\n');
}

function findFirstMatchingLine(lines: string[], pattern: RegExp | string): number | null {
  const index = lines.findIndex((line) => (
    typeof pattern === 'string'
      ? line.includes(pattern)
      : pattern.test(line)
  ));
  return index >= 0 ? index + 1 : null;
}

function pushAlert(
  alerts: HallucinationAlertRecord[],
  messages: string[],
  alert: HallucinationAlertRecord,
): void {
  if (alerts.some((existing) => existing.type === alert.type && existing.message === alert.message)) {
    return;
  }

  alerts.push(alert);
  messages.push(alert.message);
}

function detectTodoMarkers(lines: string[]): HallucinationAlertRecord[] {
  const todoPattern = /\bTODO\b|\bFIXME\b|\bHACK\b|\bXXX\b/;
  const todoMatches = lines.filter((line) => todoPattern.test(line));

  if (todoMatches.length === 0) {
    return [];
  }

  return [{
    type: 'style_issue',
    level: 'L1',
    message: `Found ${todoMatches.length} TODO/FIXME/HACK comment(s) in code`,
    suggestion: 'Resolve or remove TODO/FIXME/HACK markers before publishing the asset.',
    line: findFirstMatchingLine(lines, todoPattern),
    confidence: 0.9,
  }];
}

function detectPlaceholderStubs(lines: string[]): HallucinationAlertRecord[] {
  const placeholderPatterns = [
    /\breturn\s+null\s*;/,
    /\breturn\s+0\s*;/,
    /^\s*pass\s*$/m,
    /\.\.\.\s*$/,
    /not\s+implemented/i,
    /\bplaceholder\b/i,
  ];

  for (const pattern of placeholderPatterns) {
    const matches = lines.filter((line) => pattern.test(line) && !line.trim().startsWith('//'));
    if (matches.length > 0) {
      return [{
        type: 'logic_error',
        level: 'L2',
        message: 'Multiple placeholder or stub patterns detected',
        suggestion: 'Replace placeholder logic with a real implementation before publication.',
        line: findFirstMatchingLine(lines, pattern),
        confidence: 0.85,
      }];
    }
  }

  return [];
}

function detectRepeatedMagicNumbers(lines: string[]): HallucinationAlertRecord[] {
  const magicNumbers = lines
    .map((line) => (line.match(/\b\d+\b/g) || []).filter((value) => value.length > 1))
    .flat();
  const magicCounts: Record<string, number> = {};

  for (const value of magicNumbers) {
    magicCounts[value] = (magicCounts[value] || 0) + 1;
  }

  const repeatedMagic = Object.values(magicCounts).some((count) => count >= 3);
  if (!repeatedMagic) {
    return [];
  }

  return [{
    type: 'style_issue',
    level: 'L1',
    message: 'Repeated magic numbers detected (consider using named constants)',
    suggestion: 'Extract repeated numeric literals into named constants.',
    line: findFirstMatchingLine(lines, /\b\d+\b/),
    confidence: 0.75,
  }];
}

function detectForbiddenPatterns(lines: string[], codeContent: string): HallucinationAlertRecord[] {
  const alerts: HallucinationAlertRecord[] = [];

  for (const pattern of FORBIDDEN_PATTERNS) {
    const matched = typeof pattern.pattern === 'string'
      ? codeContent.includes(pattern.pattern)
      : pattern.pattern.test(codeContent);

    if (!matched) {
      continue;
    }

    alerts.push({
      type: 'security_risk',
      level: 'L3',
      message: pattern.id.startsWith('hardcoded-')
        ? 'Potential hardcoded secret or credential detected'
        : `${pattern.description} detected`,
      suggestion: pattern.suggestion,
      line: findFirstMatchingLine(lines, pattern.pattern),
      confidence: 0.95,
    });
  }

  return alerts;
}

function levenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () => Array<number>(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i]![0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

function findNearestApi(moduleName: string, methodName: string): string | null {
  const candidates = KNOWN_VALID_APIS[moduleName];
  if (!candidates || candidates.length === 0) {
    return null;
  }

  if (moduleName === 'requests' && methodName === 'download' && candidates.includes('get')) {
    return 'get';
  }

  return [...candidates]
    .sort((left, right) => levenshteinDistance(methodName, left) - levenshteinDistance(methodName, right))[0] ?? null;
}

function detectInvalidApis(lines: string[], codeContent: string): HallucinationAlertRecord[] {
  const alerts: HallucinationAlertRecord[] = [];
  const apiCallPattern = /\b([a-zA-Z_][\w]*)\.([a-zA-Z_][\w]*)\s*\(/g;
  const matches = [...codeContent.matchAll(apiCallPattern)];

  for (const match of matches) {
    const moduleName = match[1];
    const methodName = match[2];
    if (!moduleName || !methodName || !(moduleName in KNOWN_VALID_APIS)) {
      continue;
    }

    if (KNOWN_VALID_APIS[moduleName]!.includes(methodName)) {
      continue;
    }

    const suggestionMethod = findNearestApi(moduleName, methodName);
    alerts.push({
      type: 'invalid_api',
      level: 'L3',
      message: `${moduleName}.${methodName}() does not exist in the ${moduleName} library`,
      suggestion: suggestionMethod
        ? `Did you mean: ${moduleName}.${suggestionMethod}() ?`
        : `Use a supported ${moduleName} API from the allowlist.`,
      line: findFirstMatchingLine(lines, `${moduleName}.${methodName}(`),
      confidence: 0.95,
    });
  }

  return alerts;
}

function hasBalancedDelimiters(codeContent: string): boolean {
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };
  const openings = new Set(['(', '[', '{']);
  const stack: string[] = [];

  for (const char of codeContent) {
    if (openings.has(char)) {
      stack.push(char);
    } else if (char in pairs) {
      const expected = pairs[char]!;
      const current = stack.pop();
      if (current !== expected) {
        return false;
      }
    }
  }

  return stack.length === 0;
}

function getLanguageExtension(language?: string): string | null {
  if (!language) {
    return null;
  }

  const normalized = language.toLowerCase();
  if (normalized === 'python' || normalized === 'py') {
    return '.py';
  }
  if (normalized === 'javascript' || normalized === 'js') {
    return '.js';
  }
  if (normalized === 'typescript' || normalized === 'ts') {
    return '.ts';
  }
  if (normalized === 'bash' || normalized === 'sh' || normalized === 'shell') {
    return '.sh';
  }

  return null;
}

function buildStaticValidationCommand(
  language: string | undefined,
  validationType: string,
  filePath: string,
): ValidationCommandSpec | null {
  const normalizedLanguage = language?.toLowerCase();

  if (!normalizedLanguage || !['syntax', 'check', 'validate'].includes(validationType)) {
    return null;
  }

  if (normalizedLanguage === 'python' || normalizedLanguage === 'py') {
    return { command: 'python3', args: ['-m', 'py_compile', filePath] };
  }
  if (normalizedLanguage === 'javascript' || normalizedLanguage === 'js') {
    return { command: 'node', args: ['--check', filePath] };
  }
  if (normalizedLanguage === 'typescript' || normalizedLanguage === 'ts') {
    return { command: 'npx', args: ['tsc', '--noEmit', '--pretty', 'false', '--skipLibCheck', filePath] };
  }
  if (normalizedLanguage === 'bash' || normalizedLanguage === 'sh' || normalizedLanguage === 'shell') {
    return { command: 'bash', args: ['-n', filePath] };
  }

  return null;
}

function getStaticValidationEvidence(
  codeContent: string,
  language: string | undefined,
  validationType: string,
): ValidationResultRecord | null {
  const extension = getLanguageExtension(language);
  if (!extension) {
    return null;
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evo-ah-'));
  const filePath = path.join(tempDir, `snippet${extension}`);

  try {
    fs.writeFileSync(filePath, codeContent, 'utf8');
    const command = buildStaticValidationCommand(language, validationType, filePath);
    if (!command) {
      return null;
    }

    const result = spawnSync(command.command, command.args, {
      encoding: 'utf8',
      timeout: 5000,
    });

    if (result.error) {
      return null;
    }

    const passed = result.status === 0;
    const stderr = `${result.stderr ?? ''}`.trim();
    const stdout = `${result.stdout ?? ''}`.trim();
    const output = stderr || stdout;

    return {
      type: 'syntax',
      passed,
      message: passed
        ? 'syntax validation passed'
        : output || 'syntax validation failed',
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildTrustAnchorValidation(
  trustAnchors?: Array<{ type: string; source: string; confidence: number }>,
): ValidationResultRecord | null {
  if (!trustAnchors || trustAnchors.length === 0) {
    return null;
  }

  const averageConfidence = trustAnchors.reduce((sum, anchor) => sum + anchor.confidence, 0) / trustAnchors.length;
  return {
    type: 'trust_anchor',
    passed: averageConfidence >= 0.5,
    message: averageConfidence >= 0.5
      ? `Trust anchors verified (avg confidence ${averageConfidence.toFixed(2)})`
      : `Trust anchors are too weak (avg confidence ${averageConfidence.toFixed(2)})`,
  };
}

function buildValidationResults(
  validationType: string,
  alerts: HallucinationAlertRecord[],
  codeContent: string,
  shellValidation: ValidationResultRecord | null,
  trustAnchorValidation: ValidationResultRecord | null,
): ValidationResultRecord[] {
  const syntaxPassed = shellValidation?.type === 'syntax'
    ? shellValidation.passed
    : hasBalancedDelimiters(codeContent);
  const syntaxMessage = shellValidation?.type === 'syntax'
    ? shellValidation.message
    : syntaxPassed
      ? 'Syntax valid'
      : 'Syntax appears invalid';
  const hasStyleIssues = alerts.some((alert) => alert.type === 'style_issue');
  const hasSecurityRisk = alerts.some((alert) => alert.type === 'security_risk');

  const validationsByType: Record<string, ValidationResultRecord[]> = {
    check: [
      { type: 'syntax', passed: syntaxPassed, message: syntaxMessage },
      { type: 'linter', passed: !hasStyleIssues, message: hasStyleIssues ? 'Style issues detected' : 'No lint-style issues detected' },
      { type: 'security', passed: !hasSecurityRisk, message: hasSecurityRisk ? 'Security risks detected' : 'No security risks detected' },
    ],
    validate: [
      { type: 'syntax', passed: syntaxPassed, message: syntaxMessage },
      { type: 'linter', passed: !hasStyleIssues, message: hasStyleIssues ? 'Style issues detected' : 'No lint-style issues detected' },
    ],
    detect: [],
    syntax: [
      { type: 'syntax', passed: syntaxPassed, message: syntaxMessage },
    ],
    linter: [
      { type: 'linter', passed: !hasStyleIssues, message: hasStyleIssues ? 'Style issues detected' : 'No lint-style issues detected' },
    ],
    security: [
      { type: 'security', passed: !hasSecurityRisk, message: hasSecurityRisk ? 'Security risks detected' : 'No security risks detected' },
    ],
    unit_test: shellValidation
      ? [shellValidation]
      : [{ type: 'unit_test', passed: false, message: 'Unit-test execution unavailable for this language' }],
    integration: shellValidation
      ? [shellValidation]
      : [{ type: 'integration', passed: false, message: 'Integration execution unavailable for this language' }],
    benchmark: shellValidation
      ? [shellValidation]
      : [{ type: 'benchmark', passed: false, message: 'Benchmark execution unavailable for this language' }],
  };

  const validations = validationsByType[validationType] ?? [
    { type: validationType, passed: syntaxPassed && !hasSecurityRisk, message: 'Heuristic validation completed' },
  ];

  if (trustAnchorValidation) {
    validations.push(trustAnchorValidation);
  }

  return validations;
}

function calculateCheckConfidence(
  alerts: HallucinationAlertRecord[],
  validations: ValidationResultRecord[],
  codeContent: string,
  trustAnchors?: Array<{ confidence: number }>,
): number {
  const failedValidations = validations.filter((validation) => !validation.passed).length;
  const highSeverityAlerts = alerts.filter((alert) => alert.level === 'L3' || alert.level === 'L4').length;
  const mediumSeverityAlerts = alerts.filter((alert) => alert.level === 'L2').length;
  const styleAlerts = alerts.filter((alert) => alert.level === 'L1').length;
  const anchorBoost = trustAnchors && trustAnchors.length > 0
    ? Math.min(0.12, trustAnchors.reduce((sum, anchor) => sum + anchor.confidence, 0) / trustAnchors.length * 0.12)
    : 0;
  const lengthBoost = Math.min(0.05, codeContent.length / 5000 * 0.05);

  return Math.max(
    0.05,
    Math.min(
      0.99,
      0.92
        - highSeverityAlerts * 0.35
        - mediumSeverityAlerts * 0.18
        - styleAlerts * 0.08
        - failedValidations * 0.12
        + anchorBoost
        + lengthBoost,
    ),
  );
}

async function applyConfidenceHistory(
  baseConfidence: number,
  nodeId: string,
  assetId?: string,
): Promise<number> {
  const history = await prisma.hallucinationCheck.findMany({
    where: {
      node_id: nodeId,
      ...(assetId ? { asset_id: assetId } : {}),
    },
    select: {
      created_at: true,
      result: true,
    },
    orderBy: { created_at: 'desc' },
    take: 50,
  });

  if (history.length === 0) {
    return baseConfidence;
  }

  const firstSeen = history[history.length - 1]!.created_at.getTime();
  const ageDays = Math.max(0, (Date.now() - firstSeen) / (1000 * 60 * 60 * 24));
  let positiveSignals = 0;
  let negativeSignals = 0;

  for (const check of history) {
    const result = (check.result ?? {}) as Record<string, unknown>;
    if (result.passed === true || result.has_hallucination === false) {
      positiveSignals += 1;
    }
    if (result.has_hallucination === true || result.passed === false) {
      negativeSignals += 1;
    }
  }

  const historicalConfidence = Math.max(
    0.05,
    Math.min(
      0.99,
      Math.exp(-CONFIDENCE_DECAY_LAMBDA * ageDays)
        * (1 + CONFIDENCE_POSITIVE_WEIGHT * positiveSignals)
        * Math.max(0.1, 1 - CONFIDENCE_NEGATIVE_WEIGHT * negativeSignals),
    ),
  );

  return Math.max(0.05, Math.min(0.99, (baseConfidence + historicalConfidence) / 2));
}

// ------------------------------------------------------------------
// Hallucination Checks
// ------------------------------------------------------------------

export async function performCheck(
  nodeId: string,
  codeContent: string,
  validationType: string,
  assetId?: string,
  language?: string,
  trustAnchors?: Array<{
    type: string;
    source: string;
    confidence: number;
  }>,
): Promise<HallucinationCheck> {
  if (!codeContent || codeContent.trim().length === 0) {
    throw new ValidationError('code_content is required and cannot be empty');
  }
  if (!validationType) {
    throw new ValidationError('validation_type is required');
  }

  const lines = splitLines(codeContent);
  const alertMessages: string[] = [];
  const alertObjects: HallucinationAlertRecord[] = [];
  const detectorsByValidationType: Record<string, Array<() => HallucinationAlertRecord[]>> = {
    check: [
      () => detectTodoMarkers(lines),
      () => detectForbiddenPatterns(lines, codeContent),
      () => detectPlaceholderStubs(lines),
      () => detectRepeatedMagicNumbers(lines),
      () => detectInvalidApis(lines, codeContent),
    ],
    validate: [
      () => detectTodoMarkers(lines),
      () => detectPlaceholderStubs(lines),
      () => detectRepeatedMagicNumbers(lines),
    ],
    detect: [
      () => detectForbiddenPatterns(lines, codeContent),
      () => detectPlaceholderStubs(lines),
      () => detectInvalidApis(lines, codeContent),
    ],
  };

  const detectors = detectorsByValidationType[validationType] ?? detectorsByValidationType.check!;
  for (const detect of detectors) {
    for (const alert of detect()) {
      pushAlert(alertObjects, alertMessages, alert);
    }
  }

  const shellValidation = getStaticValidationEvidence(codeContent, language, validationType);
  const trustAnchorValidation = buildTrustAnchorValidation(trustAnchors);
  const validations = buildValidationResults(
    validationType,
    alertObjects,
    codeContent,
    shellValidation,
    trustAnchorValidation,
  );
  const baseConfidence = calculateCheckConfidence(alertObjects, validations, codeContent, trustAnchors);
  const confidence = await applyConfidenceHistory(baseConfidence, nodeId, assetId);
  const hasBlockingAlerts = alertObjects.some((alert) => alert.level === 'L3' || alert.level === 'L4');
  const passed = confidence >= 0.5 && !hasBlockingAlerts && validations.every((validation) => validation.passed);

  const result = {
    passed,
    has_hallucination: alertObjects.length > 0,
    alert_count: alertMessages.length,
    checks_passed: passed,
    summary: alertObjects.length > 0
      ? `Detected ${alertMessages.length} potential issue(s) in code`
      : 'No obvious hallucinations detected',
    details: alertMessages,
    alerts: alertObjects,
    validations,
    suggestions: alertObjects.map((alert) => alert.suggestion),
    language: language ?? null,
    trust_anchors_used: trustAnchors ?? [],
  };

  const check = await prisma.hallucinationCheck.create({
    data: {
      check_id: crypto.randomUUID(),
      node_id: nodeId,
      asset_id: assetId ?? null,
      code_content: codeContent,
      result: result as unknown as Prisma.InputJsonValue,
      confidence,
      alerts: alertObjects as unknown as Prisma.InputJsonValue,
      validation_type: validationType,
    },
  });

  return check as unknown as HallucinationCheck;
}

export async function validateCode(
  nodeId: string,
  codeContent: string,
  assetId?: string,
  language?: string,
): Promise<HallucinationCheck> {
  return performCheck(nodeId, codeContent, 'validate', assetId, language);
}

export async function detectHallucination(
  nodeId: string,
  codeContent: string,
  assetId?: string,
): Promise<HallucinationCheck> {
  return performCheck(nodeId, codeContent, 'detect', assetId);
}

export async function getCheck(
  checkId: string,
  nodeId?: string,
): Promise<HallucinationCheck | null> {
  const check = await prisma.hallucinationCheck.findUnique({
    where: { check_id: checkId },
  });

  if (check && nodeId && check.node_id !== nodeId) {
    return null;
  }

  return check as unknown as HallucinationCheck | null;
}

export async function listChecks(
  nodeId: string,
  limit = 20,
  offset = 0,
): Promise<{ items: HallucinationCheck[]; total: number }> {
  const [items, total] = await Promise.all([
    prisma.hallucinationCheck.findMany({
      where: { node_id: nodeId },
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.hallucinationCheck.count({ where: { node_id: nodeId } }),
  ]);
  return { items: items as unknown as HallucinationCheck[], total };
}

export async function getConfidence(
  nodeId: string,
  query: {
    checkId?: string;
    assetId?: string;
  } = {},
): Promise<{
  check_id: string;
  asset_id: string | null;
  confidence: number;
  validation_type: string;
  has_hallucination: boolean;
  alert_count: number;
  summary: string | null;
  created_at: Date;
}> {
  let check: HallucinationCheck | null;

  if (query.checkId) {
    const directCheck = await prisma.hallucinationCheck.findUnique({
      where: { check_id: query.checkId },
    });
    check = directCheck as unknown as HallucinationCheck | null;
    if (!check || check.node_id !== nodeId) {
      throw new NotFoundError('HallucinationCheck', query.checkId);
    }
  } else {
    const latestCheck = await prisma.hallucinationCheck.findFirst({
      where: {
        node_id: nodeId,
        ...(query.assetId ? { asset_id: query.assetId } : {}),
      },
      orderBy: { created_at: 'desc' },
    });
    check = latestCheck as unknown as HallucinationCheck | null;
    if (!check) {
      throw new NotFoundError('HallucinationCheck', query.assetId ?? nodeId);
    }
  }

  const result = (check.result ?? {}) as Record<string, unknown>;
  const alertCount = typeof result.alert_count === 'number'
    ? result.alert_count
    : Array.isArray(check.alerts)
      ? check.alerts.length
      : 0;

  return {
    check_id: check.check_id,
    asset_id: check.asset_id ?? null,
    confidence: check.confidence,
    validation_type: check.validation_type,
    has_hallucination: result.has_hallucination === true,
    alert_count: alertCount,
    summary: typeof result.summary === 'string' ? result.summary : null,
    created_at: check.created_at,
  };
}

export function listForbiddenPatterns(): Array<{
  id: string;
  category: string;
  description: string;
}> {
  return FORBIDDEN_PATTERNS.map((pattern) => ({
    id: pattern.id,
    category: pattern.category,
    description: pattern.description,
  }));
}

export async function getCheckStats(): Promise<{
  total_checks: number;
  avg_confidence: number;
  checks_with_alerts: number;
  alert_rate: number;
  recent_24h: number;
  by_validation_type: Record<string, number>;
}> {
  const checks = await prisma.hallucinationCheck.findMany({
    select: {
      validation_type: true,
      confidence: true,
      result: true,
      created_at: true,
    },
  });

  const totalChecks = checks.length;
  if (totalChecks === 0) {
    return {
      total_checks: 0,
      avg_confidence: 0,
      checks_with_alerts: 0,
      alert_rate: 0,
      recent_24h: 0,
      by_validation_type: {},
    };
  }

  const recentThreshold = Date.now() - 24 * 60 * 60 * 1000;
  let confidenceSum = 0;
  let checksWithAlerts = 0;
  let recent24h = 0;
  const byValidationType: Record<string, number> = {};

  for (const check of checks) {
    confidenceSum += check.confidence;
    if (check.created_at.getTime() >= recentThreshold) {
      recent24h += 1;
    }

    byValidationType[check.validation_type] = (byValidationType[check.validation_type] ?? 0) + 1;

    const result = (check.result ?? {}) as Record<string, unknown>;
    if (result.has_hallucination === true) {
      checksWithAlerts += 1;
    }
  }

  return {
    total_checks: totalChecks,
    avg_confidence: confidenceSum / totalChecks,
    checks_with_alerts: checksWithAlerts,
    alert_rate: checksWithAlerts / totalChecks,
    recent_24h: recent24h,
    by_validation_type: byValidationType,
  };
}

// ------------------------------------------------------------------
// Trust Anchors
// ------------------------------------------------------------------

export async function listAnchors(
  type?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: TrustAnchor[]; total: number }> {
  const where = type ? { type } : {};
  const [items, total] = await Promise.all([
    prisma.trustAnchor.findMany({
      where,
      orderBy: { verified_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.trustAnchor.count({ where }),
  ]);
  return { items: items as unknown as TrustAnchor[], total };
}

export async function addAnchor(
  type: string,
  source: string,
  confidence: number,
  expiresAt: Date,
): Promise<TrustAnchor> {
  if (!type) {
    throw new ValidationError('type is required');
  }
  if (!source) {
    throw new ValidationError('source is required');
  }
  if (isNaN(confidence) || confidence < 0 || confidence > 1) {
    throw new ValidationError('confidence must be a number between 0 and 1');
  }
  if (!expiresAt || expiresAt <= new Date()) {
    throw new ValidationError('expires_at must be a future date');
  }

  const anchor = await prisma.trustAnchor.create({
    data: { type, source, confidence, expires_at: expiresAt },
  });
  return anchor as unknown as TrustAnchor;
}

// ------------------------------------------------------------------
// Memory Graph Nodes
// ------------------------------------------------------------------

export async function listGraphNodes(
  type?: string,
  minConfidence?: number,
  limit = 20,
  offset = 0,
): Promise<{ items: MemoryGraphNode[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (minConfidence !== undefined) where.confidence = { gte: minConfidence };

  const [items, total] = await Promise.all([
    prisma.memoryGraphNode.findMany({
      where,
      orderBy: { gdi_score: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.memoryGraphNode.count({ where }),
  ]);
  return { items: items as unknown as MemoryGraphNode[], total };
}

export async function getGraphNode(nodeId: string): Promise<MemoryGraphNode | null> {
  const node = await prisma.memoryGraphNode.findUnique({
    where: { node_id: nodeId },
  });
  return node as unknown as MemoryGraphNode | null;
}

export async function upsertGraphNode(
  nodeId: string,
  type: string,
  label: string,
  metadata?: Record<string, unknown>,
): Promise<MemoryGraphNode> {
  if (!nodeId) {
    throw new ValidationError('node_id is required');
  }
  if (!type) {
    throw new ValidationError('type is required');
  }
  if (!label) {
    throw new ValidationError('label is required');
  }

  const node = await prisma.memoryGraphNode.upsert({
    where: { node_id: nodeId },
    update: {
      type,
      label,
      metadata: metadata as unknown as Prisma.InputJsonValue | undefined,
      updated_at: new Date(),
    },
    create: {
      node_id: nodeId,
      type,
      label,
      metadata: metadata as unknown as Prisma.InputJsonValue | undefined,
    },
  });
  return node as unknown as MemoryGraphNode;
}

// ------------------------------------------------------------------
// Memory Graph Edges
// ------------------------------------------------------------------

export async function listGraphEdges(
  sourceId?: string,
  targetId?: string,
  limit = 20,
  offset = 0,
): Promise<{ items: MemoryGraphEdge[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (sourceId) where.source_id = sourceId;
  if (targetId) where.target_id = targetId;

  const [items, total] = await Promise.all([
    prisma.memoryGraphEdge.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.memoryGraphEdge.count({ where }),
  ]);
  return { items: items as unknown as MemoryGraphEdge[], total };
}

export async function createGraphEdge(
  sourceId: string,
  targetId: string,
  relation: string,
  weight = 0.5,
): Promise<MemoryGraphEdge> {
  if (!sourceId) {
    throw new ValidationError('source_id is required');
  }
  if (!targetId) {
    throw new ValidationError('target_id is required');
  }
  if (!relation) {
    throw new ValidationError('relation is required');
  }
  if (isNaN(weight) || weight < 0 || weight > 1) {
    throw new ValidationError('weight must be a number between 0 and 1');
  }

  // Verify both nodes exist
  const [sourceNode, targetNode] = await Promise.all([
    prisma.memoryGraphNode.findUnique({ where: { node_id: sourceId } }),
    prisma.memoryGraphNode.findUnique({ where: { node_id: targetId } }),
  ]);

  if (!sourceNode) {
    throw new NotFoundError('MemoryGraphNode', sourceId);
  }
  if (!targetNode) {
    throw new NotFoundError('MemoryGraphNode', targetId);
  }

  const edge = await prisma.memoryGraphEdge.create({
    data: { source_id: sourceId, target_id: targetId, relation, weight },
  });
  return edge as unknown as MemoryGraphEdge;
}

// ------------------------------------------------------------------
// Capability Chains
// ------------------------------------------------------------------

export async function getCapabilityChain(
  rootAssetId: string,
): Promise<CapabilityChain | null> {
  const chain = await prisma.capabilityChain.findFirst({
    where: { root_asset_id: rootAssetId },
    orderBy: { constructed_at: 'desc' },
  });
  return chain as unknown as CapabilityChain | null;
}
