/**
 * Tests for Evolution Circle Engine
 * Phase 6+: Group Evolution System
 */

import {
  createCircle,
  getCircle,
  updateCircleState,
  listCircles,
  listMyCircles,
  joinCircle,
  leaveCircle,
  addGeneToCircle,
  createRound,
  getRound,
  listRounds,
  castVote,
  finalizeRound,
  executeRound,
  createInvite,
  respondToInvite,
  resetStores as resetCircleStores,
} from '../src/circle/engine';

describe('Circle Engine', () => {
  beforeEach(() => {
    resetCircleStores();
  });

  // ============ Circle Creation ============

  describe('createCircle', () => {
    it('should create a circle with founder as member', () => {
      const circle = createCircle('node_founder', 'Test Circle', 'A test evolution circle');

      expect(circle.circle_id).toMatch(/^circle_[a-f0-9]+$/);
      expect(circle.name).toBe('Test Circle');
      expect(circle.description).toBe('A test evolution circle');
      expect(circle.founder).toBe('node_founder');
      expect(circle.state).toBe('forming');
      expect(circle.members).toHaveLength(1);
      expect(circle.members[0].node_id).toBe('node_founder');
      expect(circle.members[0].role).toBe('founder');
      expect(circle.gene_pool).toHaveLength(0);
      expect(circle.rounds_completed).toBe(0);
      expect(circle.created_at).toBeTruthy();
      expect(circle.updated_at).toBeTruthy();
    });

    it('should generate unique circle IDs', () => {
      const c1 = createCircle('node_1', 'Circle 1', 'Desc 1');
      const c2 = createCircle('node_2', 'Circle 2', 'Desc 2');
      expect(c1.circle_id).not.toBe(c2.circle_id);
    });
  });

  // ============ Circle Retrieval ============

  describe('getCircle', () => {
    it('should retrieve existing circle by ID', () => {
      const created = createCircle('node_founder', 'Test', 'Desc');
      const retrieved = getCircle(created.circle_id);
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent circle', () => {
      const result = getCircle('circle_nonexistent');
      expect(result).toBeUndefined();
    });
  });

  // ============ Circle State ============

  describe('updateCircleState', () => {
    it('should update circle state', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const updated = updateCircleState(circle.circle_id, 'active');

      expect(updated).toBeDefined();
      expect(updated!.state).toBe('active');
      expect(updated!.updated_at).toBeTruthy();
    });

    it('should return undefined for non-existent circle', () => {
      const result = updateCircleState('circle_nonexistent', 'active');
      expect(result).toBeUndefined();
    });

    it('should allow transitioning through circle lifecycle', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      expect(circle.state).toBe('forming');

      updateCircleState(circle.circle_id, 'active');
      expect(getCircle(circle.circle_id)!.state).toBe('active');

      updateCircleState(circle.circle_id, 'evolving');
      expect(getCircle(circle.circle_id)!.state).toBe('evolving');

      updateCircleState(circle.circle_id, 'completed');
      expect(getCircle(circle.circle_id)!.state).toBe('completed');

      updateCircleState(circle.circle_id, 'dissolved');
      expect(getCircle(circle.circle_id)!.state).toBe('dissolved');
    });
  });

  // ============ Circle Listing ============

  describe('listCircles', () => {
    it('should list all circles sorted by created_at desc', () => {
      const c1 = createCircle('node_1', 'Circle 1', 'Desc 1');
      const c2 = createCircle('node_2', 'Circle 2', 'Desc 2');
      const c3 = createCircle('node_3', 'Circle 3', 'Desc 3');

      const all = listCircles();
      expect(all).toHaveLength(3);
      // Most recent first
      expect(all[0].circle_id).toBe(c3.circle_id);
      expect(all[1].circle_id).toBe(c2.circle_id);
      expect(all[2].circle_id).toBe(c1.circle_id);
    });

    it('should filter by state', () => {
      const c1 = createCircle('node_1', 'Active Circle', 'Desc');
      const c2 = createCircle('node_2', 'Forming Circle', 'Desc');
      updateCircleState(c2.circle_id, 'active');

      const activeCircles = listCircles({ state: 'active' });
      expect(activeCircles).toHaveLength(1);
      expect(activeCircles[0].circle_id).toBe(c2.circle_id);

      const formingCircles = listCircles({ state: 'forming' });
      expect(formingCircles).toHaveLength(1);
      expect(formingCircles[0].circle_id).toBe(c1.circle_id);
    });

    it('should filter by founder', () => {
      const c1 = createCircle('node_special', 'Circle 1', 'Desc');
      createCircle('node_other', 'Circle 2', 'Desc');

      const byFounder = listCircles({ founder: 'node_special' });
      expect(byFounder).toHaveLength(1);
      expect(byFounder[0].circle_id).toBe(c1.circle_id);
    });
  });

  describe('listMyCircles', () => {
    it('should list circles where node is a member', () => {
      const circle = createCircle('node_founder', 'My Circle', 'Desc');
      joinCircle(circle.circle_id, 'node_member', 'member');

      const myCircles = listMyCircles('node_founder');
      expect(myCircles.some(c => c.circle_id === circle.circle_id)).toBe(true);

      const theirCircles = listMyCircles('node_member');
      expect(theirCircles.some(c => c.circle_id === circle.circle_id)).toBe(true);

      const otherCircles = listMyCircles('node_stranger');
      expect(otherCircles.some(c => c.circle_id === circle.circle_id)).toBe(false);
    });
  });

  // ============ Member Management ============

  describe('joinCircle', () => {
    it('should allow node to join a circle as member', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = joinCircle(circle.circle_id, 'node_newbie', 'member');

      expect(result).not.toBeNull();
      expect(result!.members).toHaveLength(2);
      const newbie = result!.members.find(m => m.node_id === 'node_newbie');
      expect(newbie).toBeDefined();
      expect(newbie!.role).toBe('member');
    });

    it('should allow joining as observer', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = joinCircle(circle.circle_id, 'node_observer', 'observer');

      expect(result).not.toBeNull();
      const observer = result!.members.find(m => m.node_id === 'node_observer');
      expect(observer!.role).toBe('observer');
    });

    it('should not add duplicate members', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_newbie', 'member');
      const result = joinCircle(circle.circle_id, 'node_newbie', 'member');

      // Should not duplicate
      const updated = getCircle(circle.circle_id)!;
      const count = updated.members.filter(m => m.node_id === 'node_newbie').length;
      expect(count).toBe(1);
    });

    it('should return null for non-existent circle', () => {
      const result = joinCircle('circle_nonexistent', 'node_x', 'member');
      expect(result).toBeNull();
    });
  });

  describe('leaveCircle', () => {
    it('should allow member to leave circle', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_member', 'member');

      const left = leaveCircle(circle.circle_id, 'node_member');
      expect(left).toBe(true);

      const updated = getCircle(circle.circle_id)!;
      expect(updated.members.some(m => m.node_id === 'node_member')).toBe(false);
    });

    it('should not allow founder to leave', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const left = leaveCircle(circle.circle_id, 'node_founder');
      expect(left).toBe(false);
    });

    it('should return false for non-existent circle', () => {
      const result = leaveCircle('circle_nonexistent', 'node_x');
      expect(result).toBe(false);
    });
  });

  // ============ Gene Pool ============

  describe('addGeneToCircle', () => {
    it('should add gene to circle gene pool', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = addGeneToCircle(circle.circle_id, 'gene_test_1', 'node_founder');

      expect(result).not.toBeNull();
      expect(result!.gene_pool).toContain('gene_test_1');
      expect(result!.members.find(m => m.node_id === 'node_founder')!.contributions).toBe(1);
    });

    it('should allow any member to add genes', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_member', 'member');

      const result = addGeneToCircle(circle.circle_id, 'gene_from_member', 'node_member');
      expect(result).not.toBeNull();
      expect(result!.gene_pool).toContain('gene_from_member');
      expect(result!.members.find(m => m.node_id === 'node_member')!.contributions).toBe(1);
    });

    it('should not allow non-member to add genes', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = addGeneToCircle(circle.circle_id, 'gene_hacker', 'node_outsider');
      expect(result).toBeNull();
    });

    it('should return null for non-existent circle', () => {
      const result = addGeneToCircle('circle_nonexistent', 'gene_x', 'node_x');
      expect(result).toBeNull();
    });
  });

  // ============ Evolution Rounds ============

  describe('createRound', () => {
    it('should create a new evolution round', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      // Use founder as proposer since only founder is a member initially
      const round = createRound(
        circle.circle_id,
        'node_founder',  // proposer must be a member
        'Improve retry logic',
        'Crossbreed retry genes',
        ['gene_retry_v1', 'gene_retry_v2'],
        'crossbreed'
      );

      expect(round).not.toBeNull();
      expect(round!.round_id).toMatch(/^round_[a-f0-9]+$/);
      expect(round!.circle_id).toBe(circle.circle_id);
      expect(round!.proposer).toBe('node_founder');
      expect(round!.title).toBe('Improve retry logic');
      expect(round!.description).toBe('Crossbreed retry genes');
      expect(round!.genes).toEqual(['gene_retry_v1', 'gene_retry_v2']);
      expect(round!.mutation_type).toBe('crossbreed');
      expect(round!.status).toBe('voting');
      expect(round!.votes_for).toBe(0);
      expect(round!.votes_against).toBe(0);
    });

    it('should return null if proposer is not a member', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = createRound(circle.circle_id, 'node_outsider', 'Title', 'Desc', [], 'random');
      expect(result).toBeNull();
    });

    it('should return null for non-existent circle', () => {
      const result = createRound('circle_nonexistent', 'node_x', 'Title', 'Desc', [], 'random');
      expect(result).toBeNull();
    });
  });

  describe('getRound', () => {
    it('should retrieve round by ID', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      const retrieved = getRound(round.round_id);
      expect(retrieved).toEqual(round);
    });

    it('should return undefined for non-existent round', () => {
      const result = getRound('round_nonexistent');
      expect(result).toBeUndefined();
    });
  });

  describe('listRounds', () => {
    it('should list all rounds', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const r1 = createRound(circle.circle_id, 'node_founder', 'Round 1', 'Desc', [], 'random')!;
      const r2 = createRound(circle.circle_id, 'node_founder', 'Round 2', 'Desc', [], 'targeted')!;

      const all = listRounds();
      expect(all).toHaveLength(2);
      const ids = all.map(r => r.round_id);
      expect(ids).toContain(r1.round_id);
      expect(ids).toContain(r2.round_id);
    });

    it('should filter by circle_id', () => {
      const c1 = createCircle('node_1', 'Circle 1', 'Desc');
      const c2 = createCircle('node_2', 'Circle 2', 'Desc');
      createRound(c1.circle_id, 'node_1', 'R1', 'D', [], 'random');
      createRound(c2.circle_id, 'node_2', 'R2', 'D', [], 'random');
      createRound(c2.circle_id, 'node_2', 'R3', 'D', [], 'random');

      const c1Rounds = listRounds(c1.circle_id);
      expect(c1Rounds).toHaveLength(1);

      const c2Rounds = listRounds(c2.circle_id);
      expect(c2Rounds).toHaveLength(2);
    });

    it('should filter by status', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const r1 = createRound(circle.circle_id, 'node_founder', 'R1', 'D', [], 'random')!;
      createRound(circle.circle_id, 'node_founder', 'R2', 'D', [], 'random');

      // Cast a vote to move r1 to voting state
      castVote(r1.round_id, 'node_founder', 'approve');

      const proposed = listRounds(undefined, 'proposed');
      expect(proposed.some(r => r.round_id === r1.round_id)).toBe(false); // r1 is now voting
    });
  });

  describe('castVote', () => {
    it('should record approve vote', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      const result = castVote(round.round_id, 'node_founder', 'approve');

      expect(result).not.toBeNull();
      expect(result!.votes_for).toBe(1);
      expect(result!.votes_against).toBe(0);
      expect(result!.status).toBe('voting');
    });

    it('should record reject vote', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      const result = castVote(round.round_id, 'node_founder', 'reject');

      expect(result).not.toBeNull();
      expect(result!.votes_for).toBe(0);
      expect(result!.votes_against).toBe(1);
      expect(result!.status).toBe('voting');
    });

    it('should not allow double voting', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      const firstVote = castVote(round.round_id, 'node_founder', 'approve');
      expect(firstVote).not.toBeNull();
      expect(firstVote!.votes_for).toBe(1);

      // Second vote from same node should return null (already voted)
      const secondVote = castVote(round.round_id, 'node_founder', 'reject');
      expect(secondVote).toBeNull();
    });

    it('should return null for non-existent round', () => {
      const result = castVote('round_nonexistent', 'node_voter', 'approve');
      expect(result).toBeNull();
    });
  });

  describe('finalizeRound', () => {
    it('should finalize round as approved when votes for > votes against', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_voter1', 'member');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      castVote(round.round_id, 'node_founder', 'approve');
      castVote(round.round_id, 'node_voter1', 'approve');

      const result = finalizeRound(round.round_id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('approved');
    });

    it('should finalize round as rejected when votes against >= votes for', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_voter1', 'member');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      castVote(round.round_id, 'node_founder', 'approve');
      castVote(round.round_id, 'node_voter1', 'reject');

      const result = finalizeRound(round.round_id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('rejected');
    });

    it('should return null for non-existent round', () => {
      const result = finalizeRound('round_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('executeRound', () => {
    it('should execute approved round', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      joinCircle(circle.circle_id, 'node_voter1', 'member');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', ['gene_a', 'gene_b'], 'crossbreed')!;

      castVote(round.round_id, 'node_founder', 'approve');
      castVote(round.round_id, 'node_voter1', 'approve');
      finalizeRound(round.round_id);

      const result = executeRound(round.round_id);
      expect(result).not.toBeNull();
      expect(result!.status).toBe('executed');
      expect(result!.executed_at).toBeTruthy();

      // Circle rounds_completed should increment
      const updatedCircle = getCircle(circle.circle_id)!;
      expect(updatedCircle.rounds_completed).toBe(1);
    });

    it('should not execute rejected round', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const round = createRound(circle.circle_id, 'node_founder', 'Title', 'Desc', [], 'random')!;

      castVote(round.round_id, 'node_founder', 'reject');
      finalizeRound(round.round_id);

      const result = executeRound(round.round_id);
      expect(result).toBeNull();
    });

    it('should return null for non-existent round', () => {
      const result = executeRound('round_nonexistent');
      expect(result).toBeNull();
    });
  });

  // ============ Invitations ============

  describe('createInvite', () => {
    it('should create an invite', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const invite = createInvite(circle.circle_id, 'node_founder', 'node_invitee');

      expect(invite.circle_id).toBe(circle.circle_id);
      expect(invite.invitee).toBe('node_invitee');
      expect(invite.invited_by).toBe('node_founder');
      expect(invite.status).toBe('pending');
    });

    it('should return null if inviter is not a member', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      const result = createInvite(circle.circle_id, 'node_outsider', 'node_target');
      expect(result).toBeNull();
    });
  });

  describe('respondToInvite', () => {
    it('should accept invite and join circle', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      createInvite(circle.circle_id, 'node_founder', 'node_invitee');

      const result = respondToInvite(circle.circle_id, 'node_invitee', true);
      expect(result).toBe(true);

      const updated = getCircle(circle.circle_id)!;
      expect(updated.members.some(m => m.node_id === 'node_invitee')).toBe(true);
    });

    it('should decline invite', () => {
      const circle = createCircle('node_founder', 'Test', 'Desc');
      createInvite(circle.circle_id, 'node_founder', 'node_invitee');

      const result = respondToInvite(circle.circle_id, 'node_invitee', false);
      expect(result).toBe(true);

      const updated = getCircle(circle.circle_id)!;
      expect(updated.members.some(m => m.node_id === 'node_invitee')).toBe(false);
    });

    it('should return false for non-existent circle', () => {
      const result = respondToInvite('circle_nonexistent', 'node_x', true);
      expect(result).toBe(false);
    });
  });
});
