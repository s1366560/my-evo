import { v4 as uuidv4 } from 'uuid';
import type {
  Amendment,
  AmendmentVote,
  ConstitutionVersion,
} from './types';

const CONSTITUTION_AMENDMENT_QUORUM = 0.75; // 75% approval required (Ch25)
const CONSTITUTION_DISCUSSION_HOURS = 168; // 7 days
const CONSTITUTION_VOTING_HOURS = 168; // 7 days
const AMENDMENT_COOLDOWN_DAYS = 180; // 6 months after rejection

const CONSTITUTION_VERSION: ConstitutionVersion = {
  version: 1,
  hash: 'genesis',
  ratified_at: new Date().toISOString(),
  ratified_by: 'genesis_block',
  change_summary: 'Initial constitution - 6 core principles',
};

let amendments: Map<string, Amendment> = new Map();

export async function proposeAmendment(
  content: string,
  proposerId: string,
): Promise<Amendment> {
  const now = new Date();
  const discussionDeadline = new Date(
    now.getTime() + CONSTITUTION_DISCUSSION_HOURS * 3600_1000,
  );
  const votingDeadline = new Date(
    now.getTime() + (CONSTITUTION_DISCUSSION_HOURS + CONSTITUTION_VOTING_HOURS) * 3600_1000,
  );

  const amendment: Amendment = {
    amendment_id: `amendment-${uuidv4()}`,
    proposer_id: proposerId,
    content,
    diff: generateDiff(content),
    status: 'proposed',
    votes: [],
    quorum: CONSTITUTION_AMENDMENT_QUORUM,
    approval_rate: 0,
    discussion_deadline: discussionDeadline.toISOString(),
    voting_deadline: votingDeadline.toISOString(),
    version: CONSTITUTION_VERSION.version + amendments.size + 1,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  amendments.set(amendment.amendment_id, amendment);
  return amendment;
}

export async function voteOnAmendment(
  amendmentId: string,
  voterId: string,
  decision: 'approve' | 'reject' | 'abstain',
  weight: number = 1,
  reason?: string,
): Promise<Amendment> {
  const amendment = amendments.get(amendmentId);
  if (!amendment) {
    throw new Error(`Amendment not found: ${amendmentId}`);
  }

  if (amendment.status !== 'proposed' && amendment.status !== 'voting') {
    throw new Error(`Amendment is not in a votable state: ${amendment.status}`);
  }

  // Check cooldown for rejected amendments
  if (amendment.status === 'proposed' && amendment.votes.length > 0) {
    const existingVote = amendment.votes.find(v => v.voter_id === voterId);
    if (existingVote) {
      throw new Error('Node has already voted on this amendment');
    }
  }

  // Check if voting deadline has passed
  if (amendment.voting_deadline) {
    const deadline = new Date(amendment.voting_deadline);
    if (new Date() > deadline) {
      amendment.status = 'expired';
      amendments.set(amendmentId, amendment);
      throw new Error('Voting deadline has passed');
    }
  }

  // Check discussion deadline
  if (amendment.status === 'proposed' && amendment.discussion_deadline) {
    const deadline = new Date(amendment.discussion_deadline);
    if (new Date() > deadline) {
      amendment.status = 'voting';
    }
  }

  const vote: AmendmentVote = {
    voter_id: voterId,
    decision,
    weight,
    reason,
    cast_at: new Date().toISOString(),
  };

  amendment.votes.push(vote);
  amendment.updated_at = new Date().toISOString();

  // Recalculate approval rate
  const { approval_rate } = calculateApprovalRate(amendment.votes);
  amendment.approval_rate = approval_rate;

  amendments.set(amendmentId, amendment);
  return amendment;
}

export async function ratifyAmendment(
  amendmentId: string,
): Promise<{
  amendment: Amendment;
  new_version: ConstitutionVersion;
}> {
  const amendment = amendments.get(amendmentId);
  if (!amendment) {
    throw new Error(`Amendment not found: ${amendmentId}`);
  }

  if (amendment.status === 'ratified') {
    throw new Error('Amendment has already been ratified');
  }

  if (amendment.status === 'rejected') {
    throw new Error('Amendment has been rejected');
  }

  const { approval_rate, total_votes } = calculateApprovalRate(amendment.votes);

  // Check quorum (need minimum participation)
  if (total_votes < 3) {
    throw new Error(`Insufficient votes for ratification: ${total_votes}/3 minimum`);
  }

  // Check 75% approval threshold
  if (approval_rate < CONSTITUTION_AMENDMENT_QUORUM) {
    amendment.status = 'rejected';
    amendments.set(amendmentId, amendment);
    throw new Error(
      `Amendment rejected: ${(approval_rate * 100).toFixed(1)}% < ${CONSTITUTION_AMENDMENT_QUORUM * 100}% required`,
    );
  }

  // Ratify
  amendment.status = 'ratified';
  amendment.ratified_at = new Date().toISOString();
  amendments.set(amendmentId, amendment);

  const newVersion: ConstitutionVersion = {
    version: CONSTITUTION_VERSION.version + 1,
    hash: generateHash(amendment.content),
    ratified_at: amendment.ratified_at,
    ratified_by: 'council_vote',
    amendment_id: amendmentId,
    change_summary: summarizeChange(amendment.content),
  };

  // In production this would update a global constant or database
  // For now we return it
  return { amendment, new_version: newVersion };
}

export async function getConstitutionVersion(): Promise<ConstitutionVersion> {
  return { ...CONSTITUTION_VERSION };
}

export async function getAmendment(amendmentId: string): Promise<Amendment | null> {
  return amendments.get(amendmentId) ?? null;
}

export async function listAmendments(filter?: {
  status?: Amendment['status'];
  proposer_id?: string;
}): Promise<Amendment[]> {
  let result = Array.from(amendments.values());

  if (filter?.status) {
    result = result.filter(a => a.status === filter.status);
  }
  if (filter?.proposer_id) {
    result = result.filter(a => a.proposer_id === filter.proposer_id);
  }

  return result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export async function checkAmendmentCooldown(proposerId: string): Promise<{
  can_propose: boolean;
  cooldown_ends_at?: string;
}> {
  const rejectedAmendments = Array.from(amendments.values())
    .filter(a => a.proposer_id === proposerId && a.status === 'rejected')
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  if (rejectedAmendments.length === 0) {
    return { can_propose: true };
  }

  const lastRejected = rejectedAmendments[0]!;
  const cooldownEnds = new Date(
    new Date(lastRejected.updated_at).getTime() + AMENDMENT_COOLDOWN_DAYS * 24 * 3600 * 1000,
  );

  if (new Date() < cooldownEnds) {
    return { can_propose: false, cooldown_ends_at: cooldownEnds.toISOString() };
  }

  return { can_propose: true };
}

function calculateApprovalRate(votes: AmendmentVote[]): {
  approval_rate: number;
  total_votes: number;
  approve_weight: number;
  reject_weight: number;
} {
  const approveWeight = votes
    .filter(v => v.decision === 'approve')
    .reduce((sum, v) => sum + v.weight, 0);
  const rejectWeight = votes
    .filter(v => v.decision === 'reject')
    .reduce((sum, v) => sum + v.weight, 0);
  const totalWeight = approveWeight + rejectWeight;

  return {
    approval_rate: totalWeight > 0 ? approveWeight / totalWeight : 0,
    total_votes: votes.length,
    approve_weight: approveWeight,
    reject_weight: rejectWeight,
  };
}

function generateDiff(content: string): string {
  return `+ ${content.split('\n').join('\n+ ')}`;
}

function generateHash(content: string): string {
  // Simple hash for demo — production would use crypto
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return `v${Math.abs(hash).toString(16)}`;
}

function summarizeChange(content: string): string {
  const firstLine = content.split('\n')[0] ?? content;
  return firstLine.length > 100 ? firstLine.slice(0, 100) + '...' : firstLine;
}

export function clearAmendments(): void {
  amendments = new Map();
}

export function getAllAmendments(): Map<string, Amendment> {
  return amendments;
}
