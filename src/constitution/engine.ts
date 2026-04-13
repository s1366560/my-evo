import { v4 as uuidv4 } from 'uuid';
import type {
  Rule,
  RuleStatus,
  RuleSeverity,
  ViolationLevel,
  ListRulesFilter,
  RuleViolation,
  ActionContext,
  EvaluationResult,
} from './types';
import { NotFoundError } from '../shared/errors';

let rules: Map<string, Rule> = new Map();
let violations: Map<string, RuleViolation> = new Map();

// ===== Built-in rules (Ch25 Constitution) =====

const BUILT_IN_RULES: Rule[] = [
  {
    rule_id: 'rule-no-malware',
    name: 'No Malicious Code',
    description: 'Agents must not publish viruses, trojans, backdoors, or ransomware',
    category: 'content_policy',
    severity: 'critical',
    enabled: true,
    priority: 100,
    condition: 'content_contains_malware',
    action: 'block_and_quarantine',
    penalty: { level: 4, reputation_penalty: 100, quarantine_level: 'L3' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-hate-speech',
    name: 'No Hate Speech',
    description: 'Agents must not publish content containing discrimination, harassment, or threats',
    category: 'content_policy',
    severity: 'high',
    enabled: true,
    priority: 90,
    condition: 'content_contains_hate_speech',
    action: 'quarantine_and_zero_reputation',
    penalty: { level: 3, reputation_penalty: 50, quarantine_level: 'L3' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-privacy-violation',
    name: 'No Privacy Violation',
    description: 'Agents must not collect or leak personal information',
    category: 'content_policy',
    severity: 'high',
    enabled: true,
    priority: 95,
    condition: 'content_contains_pii',
    action: 'quarantine_and_confiscate_credits',
    penalty: { level: 3, reputation_penalty: 50, quarantine_level: 'L3' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-disinformation',
    name: 'No Disinformation',
    description: 'Agents must not intentionally publish false knowledge',
    category: 'content_policy',
    severity: 'medium',
    enabled: true,
    priority: 70,
    condition: 'content_is_false',
    action: 'reduce_reputation',
    penalty: { level: 2, reputation_penalty: 25 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-plagiarism',
    name: 'No Plagiarism',
    description: 'Agents must not copy content without attribution',
    category: 'content_policy',
    severity: 'medium',
    enabled: true,
    priority: 60,
    condition: 'content_is_unattributed_copy',
    action: 'takedown_and_penalize',
    penalty: { level: 2, reputation_penalty: 20 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-spam',
    name: 'No Spam',
    description: 'Agents must not publish large volumes of low-value content',
    category: 'content_policy',
    severity: 'low',
    enabled: true,
    priority: 40,
    condition: 'high_volume_low_value',
    action: 'temporary_quarantine',
    penalty: { level: 1, reputation_penalty: 5, quarantine_level: 'L1' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-identity-forgery',
    name: 'No Identity Forgery',
    description: 'Agents must not impersonate other agents',
    category: 'agent_conduct',
    severity: 'critical',
    enabled: true,
    priority: 100,
    condition: 'impersonation_detected',
    action: 'permanent_ban',
    penalty: { level: 4, reputation_penalty: 100, quarantine_level: 'L3' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-gdi-manipulation',
    name: 'No GDI Manipulation',
    description: 'Agents must not manipulate GDI scores through fake reviews or self-rating',
    category: 'agent_conduct',
    severity: 'high',
    enabled: true,
    priority: 85,
    condition: 'gdi_manipulation_detected',
    action: 'reputation_reduction',
    penalty: { level: 3, reputation_penalty: 50, quarantine_level: 'L2' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-sybil-attack',
    name: 'No Sybil Attack',
    description: 'Agents must not use multiple nodes for Sybil attacks',
    category: 'agent_conduct',
    severity: 'critical',
    enabled: true,
    priority: 100,
    condition: 'sybil_pattern_detected',
    action: 'permanent_ban',
    penalty: { level: 4, reputation_penalty: 100, quarantine_level: 'L3' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-bounty-fraud',
    name: 'No Bounty Fraud',
    description: 'Agents must not make false promises in bounty bidding',
    category: 'agent_conduct',
    severity: 'medium',
    enabled: true,
    priority: 65,
    condition: 'bounty_fraud_detected',
    action: 'penalize_and_warn',
    penalty: { level: 2, reputation_penalty: 20 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-no-hallucination-bypass',
    name: 'No Hallucination Bypass',
    description: 'Agents must not bypass anti-hallucination detection mechanisms',
    category: 'agent_conduct',
    severity: 'high',
    enabled: true,
    priority: 80,
    condition: 'hallucination_bypass_detected',
    action: 'quarantine_and_reduce_reputation',
    penalty: { level: 3, reputation_penalty: 50, quarantine_level: 'L2' },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-must-disclose-capabilities',
    name: 'Must Disclose Capabilities',
    description: 'Agents must truthfully disclose their capabilities and model type',
    category: 'agent_conduct',
    severity: 'medium',
    enabled: true,
    priority: 55,
    condition: 'undisclosed_capabilities',
    action: 'warn_and_correct',
    penalty: { level: 1, reputation_penalty: 5 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-must-respond-heartbeat',
    name: 'Must Respond Heartbeat',
    description: 'Agents must respond to heartbeat requests in a timely manner',
    category: 'agent_conduct',
    severity: 'low',
    enabled: true,
    priority: 30,
    condition: 'missed_heartbeat',
    action: 'warn',
    penalty: { level: 1, reputation_penalty: 5 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-must-respect-ip',
    name: 'Must Respect IP',
    description: 'Agents must respect the intellectual property of other agents',
    category: 'agent_conduct',
    severity: 'medium',
    enabled: true,
    priority: 60,
    condition: 'ip_violation_detected',
    action: 'takedown_and_penalize',
    penalty: { level: 2, reputation_penalty: 20 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
  {
    rule_id: 'rule-must-follow-council',
    name: 'Must Follow Council Decisions',
    description: 'Agents must follow the outcomes of Council votes',
    category: 'agent_conduct',
    severity: 'high',
    enabled: true,
    priority: 75,
    condition: 'council_decision_violated',
    action: 'reputation_penalty',
    penalty: { level: 2, reputation_penalty: 30 },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    version: 1,
  },
];

// Initialize built-in rules
function initBuiltinRules(): void {
  for (const rule of BUILT_IN_RULES) {
    rules.set(rule.rule_id, rule);
  }
}

initBuiltinRules();

function matchesCondition(condition: string, context: ActionContext): boolean {
  switch (condition) {
    case 'content_contains_malware':
      return checkMalwareCondition(context);
    case 'content_contains_hate_speech':
      return checkHateSpeechCondition(context);
    case 'content_contains_pii':
      return checkPiiCondition(context);
    case 'content_is_false':
      return checkFalseContentCondition(context);
    case 'content_is_unattributed_copy':
      return checkPlagiarismCondition(context);
    case 'high_volume_low_value':
      return checkSpamCondition(context);
    case 'impersonation_detected':
      return checkImpersonationCondition(context);
    case 'gdi_manipulation_detected':
      return checkGdiManipulationCondition(context);
    case 'sybil_pattern_detected':
      return checkSybilCondition(context);
    case 'bounty_fraud_detected':
      return checkBountyFraudCondition(context);
    case 'hallucination_bypass_detected':
      return checkHallucinationBypassCondition(context);
    case 'undisclosed_capabilities':
      return checkUndisclosedCapabilitiesCondition(context);
    case 'missed_heartbeat':
      return checkMissedHeartbeatCondition(context);
    case 'ip_violation_detected':
      return checkIpViolationCondition(context);
    case 'council_decision_violated':
      return checkCouncilViolationCondition(context);
    default:
      return false;
  }
}

// Simulated condition checkers — in production these would call ML models / external services
function checkMalwareCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  const tags: string[] = (meta.tags as string[]) ?? [];
  return tags.some(t => /malware|virus|trojan|backdoor|ransomware/i.test(t));
}

function checkHateSpeechCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  const tags: string[] = (meta.tags as string[]) ?? [];
  return tags.some(t => /hate|discrimination|harassment|threat/i.test(t));
}

function checkPiiCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.contains_pii);
}

function checkFalseContentCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.flagged_as_false);
}

function checkPlagiarismCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.is_plagiarism);
}

function checkSpamCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  if (meta.is_spam) return true;
  const tags: string[] = (meta.tags as string[]) ?? [];
  return tags.some(t => /spam/i.test(t));
}

function checkImpersonationCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.is_impersonation);
}

function checkGdiManipulationCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.gdi_manipulation);
}

function checkSybilCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.sybil_detected);
}

function checkBountyFraudCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.bounty_fraud);
}

function checkHallucinationBypassCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.hallucination_bypass);
}

function checkUndisclosedCapabilitiesCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.undisclosed_capabilities);
}

function checkMissedHeartbeatCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.missed_heartbeat);
}

function checkIpViolationCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.ip_violation);
}

function checkCouncilViolationCondition(ctx: ActionContext): boolean {
  const meta = ctx.metadata ?? {};
  return Boolean(meta.council_violation);
}

export function registerRule(ruleData: Omit<Rule, 'rule_id' | 'created_at' | 'updated_at' | 'version'>): Rule {
  const now = new Date().toISOString();
  const rule: Rule = {
    ...ruleData,
    rule_id: `rule-${uuidv4()}`,
    created_at: now,
    updated_at: now,
    version: 1,
  };
  rules.set(rule.rule_id, rule);
  return rule;
}

export async function evaluateAction(
  action: string,
  context: ActionContext,
): Promise<EvaluationResult> {
  const triggeredRules: string[] = [];
  const violations: RuleViolation[] = [];
  const recommendations: string[] = [];

  const sortedRules = Array.from(rules.values())
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    if (matchesCondition(rule.condition, context)) {
      triggeredRules.push(rule.rule_id);

      const violation: RuleViolation = {
        violation_id: `violation-${uuidv4()}`,
        rule_id: rule.rule_id,
        agent_id: context.agent_id,
        action: action,
        context: context.metadata ?? {},
        severity: rule.severity,
        level: rule.penalty?.level ?? 1,
        description: rule.description,
        penalty_applied: false,
        detected_at: new Date().toISOString(),
      };
      violations.push(violation);

      recommendations.push(`Rule "${rule.name}" triggered: ${rule.action}`);
    }
  }

  const allowed = violations.length === 0;

  return { allowed, triggered_rules: triggeredRules, violations, recommendations };
}

export async function executeRule(
  ruleId: string,
  _context: ActionContext,
): Promise<{ rule: Rule; executed: boolean }> {
  const rule = rules.get(ruleId);
  if (!rule) {
    throw new NotFoundError('Rule', ruleId);
  }
  return { rule, executed: true };
}

export function listRules(filter?: ListRulesFilter): { rules: Rule[]; total: number } {
  let result = Array.from(rules.values());

  if (filter?.category) {
    result = result.filter(r => r.category === filter.category);
  }
  if (filter?.severity) {
    result = result.filter(r => r.severity === filter.severity);
  }
  if (filter?.status) {
    const isEnabled = filter.status === 'active';
    result = result.filter(r => r.enabled === isEnabled);
  }

  result.sort((a, b) => b.priority - a.priority);

  const total = result.length;
  const offset = filter?.offset ?? 0;
  const limit = filter?.limit ?? total;

  return { rules: result.slice(offset, offset + limit), total };
}

export function disableRule(ruleId: string): Rule {
  const rule = rules.get(ruleId);
  if (!rule) {
    throw new NotFoundError('Rule', ruleId);
  }
  const updated: Rule = {
    ...rule,
    enabled: false,
    updated_at: new Date().toISOString(),
  };
  rules.set(ruleId, updated);
  return updated;
}

export function getRule(ruleId: string): Rule | undefined {
  return rules.get(ruleId);
}

export function enableRule(ruleId: string): Rule {
  const rule = rules.get(ruleId);
  if (!rule) {
    throw new NotFoundError('Rule', ruleId);
  }
  const updated: Rule = {
    ...rule,
    enabled: true,
    updated_at: new Date().toISOString(),
  };
  rules.set(ruleId, updated);
  return updated;
}

export function updateRule(
  ruleId: string,
  updates: Partial<Pick<Rule, 'name' | 'description' | 'priority' | 'enabled'>>,
): Rule {
  const rule = rules.get(ruleId);
  if (!rule) {
    throw new NotFoundError('Rule', ruleId);
  }
  const updated: Rule = {
    ...rule,
    ...updates,
    updated_at: new Date().toISOString(),
    version: rule.version + 1,
  };
  rules.set(ruleId, updated);
  return updated;
}

// Exported for testing
export function resetRules(): void {
  rules = new Map();
  violations = new Map();
  initBuiltinRules();
}

export function getAllRules(): Map<string, Rule> {
  return rules;
}

// Shared violation store — imported by ethics-detector for cross-module consistency
export { violations };
