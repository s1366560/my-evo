import type { Rule, RuleConflict } from './types';
import { getAllRules } from './engine';

export async function detectConflicts(newRule?: {
  rule_id?: string;
  condition?: string;
  category?: string;
  priority?: number;
}): Promise<RuleConflict[]> {
  const conflicts: RuleConflict[] = [];
  const allRules = Array.from(getAllRules().values());

  const rulesToCheck = newRule?.rule_id
    ? allRules.filter(r => r.rule_id !== newRule.rule_id)
    : allRules;

  for (let i = 0; i < rulesToCheck.length; i++) {
    for (let j = i + 1; j < rulesToCheck.length; j++) {
      const ruleA = rulesToCheck[i]!;
      const ruleB = rulesToCheck[j]!;
      const conflict = checkPairConflict(ruleA, ruleB);

      if (conflict) {
        if (newRule?.rule_id) {
          if (ruleA.rule_id === newRule.rule_id || ruleB.rule_id === newRule.rule_id) {
            conflicts.push(conflict);
          }
        } else {
          conflicts.push(conflict);
        }
      }
    }
  }

  return conflicts;
}

function checkPairConflict(ruleA: Rule, ruleB: Rule): RuleConflict | null {
  // Same condition triggers both rules
  if (ruleA.condition === ruleB.condition && ruleA.category === ruleB.category) {
    if (ruleA.action !== ruleB.action) {
      return {
        rule_a: ruleA.rule_id,
        rule_b: ruleB.rule_id,
        conflict_type: 'contradiction',
        severity: ruleA.severity === 'critical' || ruleB.severity === 'critical' ? 'high' : 'medium',
        description: `Rules "${ruleA.name}" and "${ruleB.name}" have the same condition but different actions`,
        suggested_resolution: suggestResolution(ruleA, ruleB),
      };
    }

    return {
      rule_a: ruleA.rule_id,
      rule_b: ruleB.rule_id,
      conflict_type: 'redundancy',
      severity: 'low',
      description: `Rules "${ruleA.name}" and "${ruleB.name}" are functionally identical`,
      suggested_resolution: 'Consider disabling the lower-priority rule',
    };
  }

  // Overlapping categories with similar priority
  if (ruleA.category === ruleB.category && ruleA.priority === ruleB.priority) {
    const sharedTerms = findSharedTerms(ruleA.description, ruleB.description);
    if (sharedTerms.length >= 2) {
      return {
        rule_a: ruleA.rule_id,
        rule_b: ruleB.rule_id,
        conflict_type: 'overlap',
        severity: 'medium',
        description: `Rules "${ruleA.name}" and "${ruleB.name}" overlap in scope (shared terms: ${sharedTerms.join(', ')})`,
        suggested_resolution: 'Define clearer boundaries between these rules',
      };
    }
  }

  // Conflicting priorities in same category
  if (ruleA.category === ruleB.category) {
    const priorityDiff = Math.abs(ruleA.priority - ruleB.priority);
    if (priorityDiff <= 5 && ruleA.action !== ruleB.action) {
      return {
        rule_a: ruleA.rule_id,
        rule_b: ruleB.rule_id,
        conflict_type: 'overlap',
        severity: 'low',
        description: `Rules "${ruleA.name}" and "${ruleB.name}" have similar priority but different actions`,
        suggested_resolution: suggestResolution(ruleA, ruleB),
      };
    }
  }

  return null;
}

function suggestResolution(ruleA: Rule, ruleB: Rule): string {
  if (ruleA.severity === 'critical' || ruleB.severity === 'critical') {
    return `Critical rule takes precedence: "${ruleA.severity === 'critical' ? ruleA.name : ruleB.name}" should be kept`;
  }
  if (ruleA.priority !== ruleB.priority) {
    const higher = ruleA.priority > ruleB.priority ? ruleA.name : ruleB.name;
    return `Higher priority rule "${higher}" takes precedence`;
  }
  return `Manually resolve by evaluating the severity and scope of both rules`;
}

function findSharedTerms(descA: string, descB: string): string[] {
  const wordsA = new Set(
    descA.toLowerCase().split(/\s+/).filter(w => w.length > 4),
  );
  const wordsB = descB.toLowerCase().split(/\s+/).filter(w => w.length > 4);
  return wordsB.filter(w => wordsA.has(w));
}

export async function resolveConflict(
  ruleAId: string,
  ruleBId: string,
  resolution: 'keep_a' | 'keep_b' | 'merge' | 'disable_both',
): Promise<{
  resolved_rules: string[];
  action: string;
}> {
  const rules = getAllRules();
  const ruleA = rules.get(ruleAId);
  const ruleB = rules.get(ruleBId);

  if (!ruleA || !ruleB) {
    throw new Error(`Rules not found: ${ruleAId}, ${ruleBId}`);
  }

  switch (resolution) {
    case 'keep_a':
      return {
        resolved_rules: [ruleAId],
        action: `Kept rule "${ruleA.name}", disabled "${ruleB.name}"`,
      };

    case 'keep_b':
      return {
        resolved_rules: [ruleBId],
        action: `Kept rule "${ruleB.name}", disabled "${ruleA.name}"`,
      };

    case 'merge': {
      const mergedRule: Rule = {
        ...ruleA,
        rule_id: ruleAId,
        name: `${ruleA.name} / ${ruleB.name}`,
        description: `Merged: ${ruleA.description} | ${ruleB.description}`,
        priority: Math.max(ruleA.priority, ruleB.priority),
        updated_at: new Date().toISOString(),
        version: Math.max(ruleA.version, ruleB.version) + 1,
      };
      rules.set(ruleAId, mergedRule);
      return {
        resolved_rules: [ruleAId],
        action: `Merged "${ruleA.name}" and "${ruleB.name}" into single rule`,
      };
    }

    case 'disable_both':
      return {
        resolved_rules: [],
        action: `Disabled both "${ruleA.name}" and "${ruleB.name}"`,
      };

    default:
      throw new Error(`Unknown resolution: ${resolution}`);
  }
}

export async function suggestRulePriority(
  ruleAId: string,
  ruleBId: string,
): Promise<{
  suggestion: string;
  reasoning: string;
  recommended_priority_a?: number;
  recommended_priority_b?: number;
}> {
  const rules = getAllRules();
  const ruleA = rules.get(ruleAId);
  const ruleB = rules.get(ruleBId);

  if (!ruleA || !ruleB) {
    throw new Error(`Rules not found: ${ruleAId}, ${ruleBId}`);
  }

  // Critical severity gets higher priority
  if (ruleA.severity === 'critical' && ruleB.severity !== 'critical') {
    return {
      suggestion: 'rule_a_higher',
      reasoning: `"${ruleA.name}" is critical severity and should take precedence`,
      recommended_priority_a: Math.max(ruleA.priority, ruleB.priority + 10),
      recommended_priority_b: ruleB.priority,
    };
  }

  if (ruleB.severity === 'critical' && ruleA.severity !== 'critical') {
    return {
      suggestion: 'rule_b_higher',
      reasoning: `"${ruleB.name}" is critical severity and should take precedence`,
      recommended_priority_a: ruleA.priority,
      recommended_priority_b: Math.max(ruleB.priority, ruleA.priority + 10),
    };
  }

  // Safety-related rules get priority boost
  const safetyCategories = ['content_policy'];
  const aIsSafety = safetyCategories.includes(ruleA.category);
  const bIsSafety = safetyCategories.includes(ruleB.category);

  if (aIsSafety && !bIsSafety) {
    return {
      suggestion: 'rule_a_higher',
      reasoning: `"${ruleA.name}" is in content_policy category and should be evaluated first`,
      recommended_priority_a: Math.max(ruleA.priority, ruleB.priority + 5),
      recommended_priority_b: ruleB.priority,
    };
  }

  if (bIsSafety && !aIsSafety) {
    return {
      suggestion: 'rule_b_higher',
      reasoning: `"${ruleB.name}" is in content_policy category and should be evaluated first`,
      recommended_priority_a: ruleA.priority,
      recommended_priority_b: Math.max(ruleB.priority, ruleA.priority + 5),
    };
  }

  // Maintain current priorities if no strong reason to change
  return {
    suggestion: 'maintain_current',
    reasoning: `No strong reason to reorder — current priorities are acceptable (${ruleA.name}: ${ruleA.priority}, ${ruleB.name}: ${ruleB.priority})`,
  };
}
