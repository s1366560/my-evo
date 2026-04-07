import * as engine from './engine';
import * as ethics from './ethics-detector';
import * as amendment from './amendment';
import * as conflict from './conflict-detector';
import type { ActionContext, EthicsScore } from './types';

// ===== Service Facade =====

export async function evaluateAndRecord(
  action: string,
  context: ActionContext,
): Promise<{
  evaluation: Awaited<ReturnType<typeof engine.evaluateAction>>;
  ethics: Awaited<ReturnType<typeof ethics.detectViolation>>;
}> {
  const evaluation = await engine.evaluateAction(action, context);

  // Record violations to shared map first
  for (const violation of evaluation.violations) {
    ethics.recordViolation(violation);
  }

  // Now detect — includes both stored and newly recorded violations
  const ethicsResult = await ethics.detectViolation(action, context.agent_id, context.metadata);

  return { evaluation, ethics: ethicsResult };
}

export async function getAgentEthicsProfile(
  agentId: string,
): Promise<EthicsScore> {
  const ethicsResult = await ethics.calculateEthicsScore(agentId);
  const violations = ethics.getViolations(agentId);

  return {
    agent_id: agentId,
    score: ethicsResult.score,
    violations_count: violations.length,
    last_evaluated_at: new Date().toISOString(),
    factors: ethicsResult.factors,
  };
}

// Re-export all core functions for convenience
export const registerRule = engine.registerRule;
export const evaluateAction = engine.evaluateAction;
export const executeRule = engine.executeRule;
export const listRules = engine.listRules;
export const disableRule = engine.disableRule;
export const enableRule = engine.enableRule;
export const getRule = engine.getRule;
export const updateRule = engine.updateRule;

export const detectViolation = ethics.detectViolation;
export const checkConflictsOfInterest = ethics.checkConflictsOfInterest;
export const checkTransparencyRequirement = ethics.checkTransparencyRequirement;
export const calculateEthicsScore = ethics.calculateEthicsScore;
export const recordViolation = ethics.recordViolation;
export const clearViolations = ethics.clearViolations;
export const getViolations = ethics.getViolations;

export const proposeAmendment = amendment.proposeAmendment;
export const voteOnAmendment = amendment.voteOnAmendment;
export const ratifyAmendment = amendment.ratifyAmendment;
export const getConstitutionVersion = amendment.getConstitutionVersion;
export const getAmendment = amendment.getAmendment;
export const listAmendments = amendment.listAmendments;
export const checkAmendmentCooldown = amendment.checkAmendmentCooldown;

export const detectConflicts = conflict.detectConflicts;
export const resolveConflict = conflict.resolveConflict;
export const suggestRulePriority = conflict.suggestRulePriority;

// Test helpers
export function resetService(): void {
  engine.resetRules();
  ethics.clearViolations();
  amendment.clearAmendments();
}
