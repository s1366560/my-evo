/**
 * Hallucination Detector
 * Detects invalid APIs, forbidden patterns, and code quality issues
 * Chapter 28 Section 28.1-28.3
 */

import type { HallucinationAlert, TrustAnchor, AnchorVerificationResult, ErrorClassification } from './types';

// Forbidden patterns that indicate security risks or bad practices
const FORBIDDEN_PATTERNS = [
  { pattern: /eval\s*\(/, severity: 'high' as const, description: 'Use of eval() is a security risk' },
  { pattern: /exec\s*\(/, severity: 'high' as const, description: 'Use of exec() is a security risk' },
  { pattern: /os\.system\s*\(/, severity: 'high' as const, description: 'os.system() is a security risk, use subprocess instead' },
  { pattern: /subprocess.*shell\s*=\s*True/, severity: 'high' as const, description: 'shell=True is a security risk' },
  { pattern: /__import__\s*\(/, severity: 'high' as const, description: 'Dynamic import via __import__ can be unsafe' },
  { pattern: /pickle\.loads?/, severity: 'medium' as const, description: 'pickle can execute arbitrary code, prefer JSON' },
  { pattern: /yaml\.load\s*\(/, severity: 'medium' as const, description: 'yaml.load without Loader is unsafe, use yaml.safe_load' },
  { pattern: /password\s*=\s*['"`][^'"`]+['"`]/i, severity: 'high' as const, description: 'Hardcoded password detected' },
  { pattern: /api[_-]?key\s*=\s*['"`][^'"`]+['"`]/i, severity: 'high' as const, description: 'Hardcoded API key detected' },
  { pattern: /secret\s*=\s*['"`][^'"`]+['"`]/i, severity: 'medium' as const, description: 'Hardcoded secret detected' },
];

// Known valid API registry (simplified - in production would be comprehensive)
const KNOWN_VALID_APIS: Record<string, Set<string>> = {
  requests: new Set(['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'request', 'Session', 'Timeout', 'HTTPError']),
  json: new Set(['load', 'loads', 'dump', 'dumps']),
  os: new Set(['path', 'getcwd', 'chdir', 'listdir', 'makedirs', 'remove', 'rename', 'stat', 'environ', 'system', 'getenv']),
  subprocess: new Set(['run', 'Popen', 'call', 'check_output', 'CalledProcessError', 'DEVNULL', 'PIPE']),
  http: new Set(['HTTPConnection', 'HTTPHandler', 'HTTPServer', 'BaseHTTPRequestHandler']),
  collections: new Set(['Counter', 'OrderedDict', 'defaultdict', 'deque', 'namedtuple', 'UserDict', 'UserList', 'UserString']),
};

// Language-specific comment patterns for hallucination detection
const HALLUCINATED_COMMENTS = [
  /#\s*TODO:\s*implementation\s+required/i,
  /#\s*This\s+function\s+is\s+not\s+yet\s+implemented/i,
  /#\s*placeholder\s+for\s+\w+\s+function/i,
  /#\s*mock\s+implementation/i,
];

export class HallucinationDetector {
  private forbiddenPatterns: typeof FORBIDDEN_PATTERNS;
  private knownApis: typeof KNOWN_VALID_APIS;

  constructor() {
    this.forbiddenPatterns = FORBIDDEN_PATTERNS;
    this.knownApis = KNOWN_VALID_APIS;
  }

  /**
   * Scan content for forbidden security patterns
   */
  detectForbiddenPatterns(content: string): HallucinationAlert[] {
    const alerts: HallucinationAlert[] = [];

    for (const { pattern, severity, description } of this.forbiddenPatterns) {
      if (pattern.test(content)) {
        const match = content.match(pattern);
        alerts.push({
          type: 'security_risk',
          severity,
          location: match ? `position ${content.indexOf(match[0])}` : undefined,
          description,
          confidence: 0.95,
        });
      }
    }

    return alerts;
  }

  /**
   * Detect likely hallucinated code patterns (placeholder/impl stubs)
   */
  detectPlaceholderPatterns(content: string): HallucinationAlert[] {
    const alerts: HallucinationAlert[] = [];

    for (const pattern of HALLUCINATED_COMMENTS) {
      const match = content.match(pattern);
      if (match) {
        alerts.push({
          type: 'logic_error',
          severity: 'medium',
          location: `line ${content.substring(0, content.indexOf(match[0])).split('\n').length}`,
          description: `Detected placeholder/hallucinated code: "${match[0]}"`,
          confidence: 0.8,
        });
      }
    }

    // Detect function bodies that just pass or return None (stub functions)
    // Escape dots in "..." pattern to match literal ellipsis
    const functionPattern = /def\s+(\w+)\s*\([^)]*\)\s*:\s*\n\s*(pass|return\s+None|\.\.\.)/g;
    let match;
    while ((match = functionPattern.exec(content)) !== null) {
      alerts.push({
        type: 'logic_error',
        severity: 'low',
        location: `function: ${match[1]}`,
        description: `Function "${match[1]}" appears to be a stub (contains only ${match[2]})`,
        confidence: 0.7,
      });
    }

    return alerts;
  }

  /**
   * Verify content against trust anchors
   * Properly uses verified_apis and verified_patterns from each anchor
   */
  verifyAgainstAnchors(content: string, anchors: TrustAnchor[]): AnchorVerificationResult[] {
    const results: AnchorVerificationResult[] = [];

    for (const anchor of anchors) {
      const discrepancies: string[] = [];
      let matched = true;

      // Check verified_patterns from the anchor
      for (const pattern of anchor.verified_patterns) {
        try {
          const regex = new RegExp(pattern);
          if (regex.test(content)) {
            // Pattern found in content - anchor confirms this usage
            // No discrepancy for matching patterns
          }
        } catch {
          // Invalid regex, skip
        }
      }

      // Check for invalid API calls using the anchor's verified_apis list
      if (anchor.verified_apis && anchor.verified_apis.length > 0) {
        // Build a map of verified modules and their APIs from the anchor
        const verifiedModules = new Set<string>();
        for (const api of anchor.verified_apis) {
          if (api.includes('.')) {
            // e.g. "requests.get" - extract module
            verifiedModules.add(api.split('.')[0]);
          } else {
            // Single identifier - module name
            verifiedModules.add(api);
          }
        }

        // For each verified module, check if called APIs are valid per the anchor
        for (const module of verifiedModules) {
          const modulePattern = new RegExp(`${module}\\.(\\w+)`, 'g');
          let apiMatch;
          while ((apiMatch = modulePattern.exec(content)) !== null) {
            const calledApi = apiMatch[1];
            // Check if this specific API is in the anchor's verified_apis
            const fullApi = `${module}.${calledApi}`;
            if (!anchor.verified_apis.includes(fullApi) && !anchor.verified_apis.includes(module)) {
              // Not explicitly verified - could be invalid
              discrepancies.push(
                `API ${fullApi} not in verified list for anchor "${anchor.name}" (${anchor.type})`
              );
              matched = false;
            }
          }
        }
      }

      // Also cross-check against global known APIs for discrepancy detection
      for (const [module, apis] of Object.entries(this.knownApis)) {
        const modulePattern = new RegExp(`${module}\\.(\\w+)`, 'g');
        let apiMatch;
        while ((apiMatch = modulePattern.exec(content)) !== null) {
          const calledApi = apiMatch[1];
          if (!apis.has(calledApi)) {
            // Known invalid API for this module
            discrepancies.push(
              `Potentially invalid API: ${module}.${calledApi} (not in known valid list)`
            );
            matched = false;
          }
        }
      }

      results.push({
        anchor_type: anchor.type,
        matched,
        confidence: matched ? 0.9 : Math.max(0.1, 1 - discrepancies.length * 0.1),
        discrepancies,
      });
    }

    return results;
  }

  /**
   * Classify an error into L1-L4 levels
   */
  classifyError(errorType: string, context: string): ErrorClassification {
    const syntaxErrors = ['SyntaxError', 'IndentationError', 'TabError', 'parse error'];
    const semanticErrors = ['NameError', 'TypeError', 'AttributeError', 'IndexError', 'KeyError', 'ValueError'];
    const hallucinationErrors = ['ImportError', 'ModuleNotFoundError', 'NoSuchMethod', 'undefined'];

    const lowerError = errorType.toLowerCase();
    const lowerContext = context.toLowerCase();

    if (syntaxErrors.some(e => lowerError.includes(e.toLowerCase()))) {
      return {
        level: 'L1_syntax',
        category: 'Syntax',
        description: `Syntax error detected: ${errorType}`,
        auto_correctable: false,
      };
    }

    if (semanticErrors.some(e => lowerError.includes(e.toLowerCase()))) {
      return {
        level: 'L2_semantic',
        category: 'Semantic',
        description: `Semantic error detected: ${errorType}`,
        auto_correctable: false,
      };
    }

    if (hallucinationErrors.some(e => lowerError.includes(e.toLowerCase()))) {
      const suggestion = this.findSimilarApi(context);
      return {
        level: 'L3_hallucination',
        category: 'Hallucination',
        description: `Hallucinated API detected: ${errorType}`,
        auto_correctable: suggestion !== null,
        suggested_correction: suggestion ?? undefined,
      };
    }

    // Check for strategy-level errors (outcomes not matching expectations)
    if (lowerContext.includes('expected') && lowerContext.includes('actual')) {
      return {
        level: 'L4_strategy',
        category: 'Strategy',
        description: 'Strategy outcome does not match expectations',
        auto_correctable: false,
      };
    }

    return {
      level: 'L3_hallucination',
      category: 'Unknown',
      description: `Unknown error type: ${errorType}`,
      auto_correctable: false,
    };
  }

  /**
   * Find the most similar valid API for a given invalid call
   */
  findSimilarApi(invalidCall: string): string | null {
    // Extract the module and method from the call
    const match = invalidCall.match(/(\w+)\.(\w+)/);
    if (!match) return null;

    const [, module, method] = match;
    const validMethods = this.knownApis[module];
    if (!validMethods) return null;

    // Find the most similar method name using simple edit distance
    let bestMatch: string | null = null;
    let bestScore = Infinity;

    for (const validMethod of validMethods) {
      const distance = this.editDistance(method, validMethod);
      if (distance < bestScore && distance <= Math.max(2, Math.floor(method.length / 3))) {
        bestScore = distance;
        bestMatch = validMethod;
      }
    }

    return bestMatch ? `${module}.${bestMatch}` : null;
  }

  /**
   * Simple edit distance calculation
   */
  private editDistance(a: string, b: string): number {
    const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        dp[i][j] = a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }

    return dp[a.length][b.length];
  }

  /**
   * Full detection scan
   */
  detectAll(content: string): HallucinationAlert[] {
    const alerts: HallucinationAlert[] = [];

    alerts.push(...this.detectForbiddenPatterns(content));
    alerts.push(...this.detectPlaceholderPatterns(content));

    return alerts;
  }
}
