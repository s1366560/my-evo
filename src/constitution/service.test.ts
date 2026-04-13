import * as service from './service';
import * as engine from './engine';
import * as ethics from './ethics-detector';
import * as amendment from './amendment';
import * as conflict from './conflict-detector';
import { ConflictError, NotFoundError, ValidationError } from '../shared/errors';

beforeEach(() => {
  service.resetService();
});

describe('Constitution Service', () => {
  describe('Rule Engine', () => {
    describe('listRules', () => {
      it('should list all built-in rules', () => {
        const { rules, total } = service.listRules();
        expect(total).toBeGreaterThan(0);
        expect(rules.length).toBe(total);
      });

      it('should filter rules by category', () => {
        const { rules } = service.listRules({ category: 'content_policy' });
        expect(rules.length).toBeGreaterThan(0);
        for (const rule of rules) {
          expect(rule.category).toBe('content_policy');
        }
      });

      it('should filter rules by severity', () => {
        const { rules } = service.listRules({ severity: 'critical' });
        for (const rule of rules) {
          expect(rule.severity).toBe('critical');
        }
      });

      it('should filter rules by status', () => {
        const { rules } = service.listRules({ status: 'active' });
        for (const rule of rules) {
          expect(rule.enabled).toBe(true);
        }
      });

      it('should paginate rules', () => {
        const page1 = service.listRules({ limit: 5, offset: 0 });
        const page2 = service.listRules({ limit: 5, offset: 5 });
        expect(page1.rules.length).toBe(5);
        expect(page2.rules.length).toBeLessThanOrEqual(5);
      });

      it('should sort rules by priority descending', () => {
        const { rules } = service.listRules();
        for (let i = 1; i < rules.length; i++) {
          expect(rules[i - 1]!.priority).toBeGreaterThanOrEqual(rules[i]!.priority);
        }
      });
    });

    describe('registerRule', () => {
      it('should register a new rule', () => {
        const rule = service.registerRule({
          name: 'Test Rule',
          description: 'A test rule',
          category: 'test',
          severity: 'medium',
          enabled: true,
          priority: 50,
          condition: 'test_condition',
          action: 'test_action',
        });

        expect(rule.rule_id).toBeDefined();
        expect(rule.name).toBe('Test Rule');
        expect(rule.enabled).toBe(true);
        expect(rule.version).toBe(1);
      });

      it('should set created_at and updated_at', () => {
        const rule = service.registerRule({
          name: 'Timestamp Test',
          description: 'desc',
          category: 'test',
          severity: 'low',
          enabled: true,
          priority: 10,
          condition: 'cond',
          action: 'act',
        });

        expect(rule.created_at).toBeDefined();
        expect(rule.updated_at).toBeDefined();
      });
    });

    describe('disableRule', () => {
      it('should disable an existing rule', () => {
        const { rules } = service.listRules({ status: 'active' });
        const ruleToDisable = rules[0]!;

        const disabled = service.disableRule(ruleToDisable.rule_id);
        expect(disabled.enabled).toBe(false);
        expect(disabled.rule_id).toBe(ruleToDisable.rule_id);
      });

      it('should throw for non-existent rule', () => {
        expect(() => service.disableRule('nonexistent-rule')).toThrow(NotFoundError);
      });
    });

    describe('enableRule', () => {
      it('should enable a disabled rule', () => {
        const { rules } = service.listRules({ status: 'active' });
        const ruleToToggle = rules[0]!;

        service.disableRule(ruleToToggle.rule_id);
        const reEnabled = service.enableRule(ruleToToggle.rule_id);
        expect(reEnabled.enabled).toBe(true);
      });
    });

    describe('getRule', () => {
      it('should return a rule by id', () => {
        const { rules } = service.listRules();
        const firstRule = rules[0]!;
        const rule = service.getRule(firstRule.rule_id);
        expect(rule).toBeDefined();
        expect(rule?.rule_id).toBe(firstRule.rule_id);
      });

      it('should return undefined for unknown id', () => {
        const rule = service.getRule('unknown-id');
        expect(rule).toBeUndefined();
      });
    });

    describe('evaluateAction', () => {
      it('should allow compliant action', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'publish_asset',
          metadata: {},
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('publish_asset', context);
        expect(result.allowed).toBe(true);
      });

      it('should detect malware content violation', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'publish_asset',
          metadata: { tags: ['malware', 'virus'] },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('publish_asset', context);
        expect(result.allowed).toBe(false);
        expect(result.triggered_rules).toContain('rule-no-malware');
        expect(result.violations.length).toBeGreaterThan(0);
        expect(result.violations[0]!.severity).toBe('critical');
      });

      it('should detect hate speech violation', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'publish_content',
          metadata: { tags: ['hate_speech', 'discrimination'] },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('publish_content', context);
        expect(result.allowed).toBe(false);
        expect(result.triggered_rules).toContain('rule-no-hate-speech');
      });

      it('should detect impersonation violation', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'impersonate',
          metadata: { is_impersonation: true },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('impersonate', context);
        expect(result.allowed).toBe(false);
        expect(result.violations.some(v => v.rule_id === 'rule-no-identity-forgery')).toBe(true);
      });

      it('should detect GDI manipulation', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'manipulate_score',
          metadata: { gdi_manipulation: true },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('manipulate_score', context);
        expect(result.allowed).toBe(false);
        expect(result.violations.some(v => v.rule_id === 'rule-no-gdi-manipulation')).toBe(true);
      });

      it('should include recommendations in evaluation result', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'spam_content',
          metadata: { is_spam: true },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('spam_content', context);
        expect(result.recommendations.length).toBeGreaterThan(0);
      });

      it('should trigger multiple violations', async () => {
        const context = {
          agent_id: 'agent-1',
          action: 'malicious_spam',
          metadata: { tags: ['malware', 'spam'] },
          timestamp: new Date().toISOString(),
        };

        const result = await service.evaluateAction('malicious_spam', context);
        expect(result.violations.length).toBeGreaterThanOrEqual(2);
      });
    });

    describe('executeRule', () => {
      it('should execute a rule', async () => {
        const { rules } = service.listRules({ status: 'active' });
        const firstRule = rules[0]!;
        const result = await service.executeRule(firstRule.rule_id, {
          agent_id: 'agent-1',
          action: 'test',
          timestamp: new Date().toISOString(),
        });
        expect(result.executed).toBe(true);
        expect(result.rule.rule_id).toBe(firstRule.rule_id);
      });

      it('should throw for unknown rule', async () => {
        await expect(
          service.executeRule('unknown', { agent_id: 'a', action: 'a', timestamp: '' }),
        ).rejects.toThrow(NotFoundError);
      });
    });
  });

  describe('Ethics Detector', () => {
    describe('detectViolation', () => {
      it('should return no violation for clean agent', async () => {
        const result = await service.detectViolation('publish', 'clean-agent');
        expect(result.has_violation).toBe(false);
        expect(result.severity).toBe('none');
      });
    });

    describe('checkConflictsOfInterest', () => {
      it('should detect self-dealing', async () => {
        const result = await service.checkConflictsOfInterest('agent-1', {
          type: 'transfer',
          target_id: 'agent-1',
          amount: 100,
        });
        expect(result.has_conflict).toBe(true);
        expect(result.conflict_type).toBe('self_dealing');
        expect(result.risk_level).toBe('high');
      });

      it('should detect self-approval in bounty claims', async () => {
        const result = await service.checkConflictsOfInterest('agent-1', {
          type: 'bounty_claim',
          target_id: 'agent-1',
        });
        expect(result.has_conflict).toBe(true);
        expect(result.conflict_type).toBe('self_approval');
        expect(result.risk_level).toBe('medium');
      });

      it('should detect large self-transfer', async () => {
        const result = await service.checkConflictsOfInterest('agent-1', {
          type: 'transfer',
          target_id: 'agent-1',
          amount: 2000,
        });
        expect(result.has_conflict).toBe(true);
        expect(result.risk_level).toBe('medium');
      });

      it('should return no conflict for legitimate transaction', async () => {
        const result = await service.checkConflictsOfInterest('agent-1', {
          type: 'transfer',
          target_id: 'agent-2',
          amount: 100,
        });
        expect(result.has_conflict).toBe(false);
        expect(result.risk_level).toBe('none');
      });
    });

    describe('checkTransparencyRequirement', () => {
      it('should pass when all disclosures are present', async () => {
        const result = await service.checkTransparencyRequirement('agent-1', {
          type: 'publish_asset',
          metadata: {
            capabilities_disclosed: true,
            data_sources_disclosed: true,
            limitations_disclosed: true,
          },
        });
        expect(result.meets_requirement).toBe(true);
        expect(result.transparency_score).toBe(100);
      });

      it('should fail when disclosures are missing', async () => {
        const result = await service.checkTransparencyRequirement('agent-1', {
          type: 'publish_asset',
          metadata: {},
        });
        expect(result.meets_requirement).toBe(false);
        expect(result.missing_elements.length).toBeGreaterThan(0);
      });

      it('should check bounty bid transparency', async () => {
        const result = await service.checkTransparencyRequirement('agent-1', {
          type: 'bounty_bid',
          metadata: {},
        });
        expect(result.missing_elements).toContain('experience_disclosure');
      });

      it('should reduce score for past violations', async () => {
        const result = await service.checkTransparencyRequirement('agent-1', {
          type: 'generic',
          metadata: {},
        });
        expect(result.transparency_score).toBeLessThanOrEqual(100);
      });
    });

    describe('calculateEthicsScore', () => {
      it('should return excellent tier for new agent', async () => {
        const result = await service.calculateEthicsScore('new-agent');
        expect(result.score).toBe(100);
        expect(result.tier).toBe('excellent');
        expect(result.violations_count).toBe(0);
      });

      it('should return correct factor scores', async () => {
        const result = await service.calculateEthicsScore('agent-fresh');
        expect(result.factors.transparency).toBeDefined();
        expect(result.factors.fairness).toBeDefined();
        expect(result.factors.safety).toBeDefined();
        expect(result.factors.honesty).toBeDefined();
      });

      it('should reduce score based on violation severity', async () => {
        // Manually add a violation
        service.recordViolation({
          violation_id: 'v-1',
          rule_id: 'rule-no-malware',
          agent_id: 'violation-agent',
          action: 'publish',
          context: {},
          severity: 'critical',
          level: 4,
          description: 'Published malicious code',
          penalty_applied: true,
          detected_at: new Date().toISOString(),
        });

        const result = await service.calculateEthicsScore('violation-agent');
        expect(result.score).toBeLessThan(100);
        expect(result.violations_count).toBe(1);
      });
    });

    describe('getViolations', () => {
      it('should return violations for specific agent', () => {
        service.recordViolation({
          violation_id: 'v-specific',
          rule_id: 'rule-no-spam',
          agent_id: 'specific-agent',
          action: 'spam',
          context: {},
          severity: 'low',
          level: 1,
          description: 'Spam content',
          penalty_applied: false,
          detected_at: new Date().toISOString(),
        });

        const violations = service.getViolations('specific-agent');
        expect(violations.length).toBe(1);
        expect(violations[0]!.agent_id).toBe('specific-agent');
      });

      it('should return all violations when no agent specified', () => {
        service.recordViolation({
          violation_id: 'v-all-test',
          rule_id: 'rule-no-malware',
          agent_id: 'agent-all',
          action: 'test',
          context: {},
          severity: 'high',
          level: 3,
          description: 'Test violation',
          penalty_applied: false,
          detected_at: new Date().toISOString(),
        });
        const all = service.getViolations();
        expect(all.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Amendment', () => {
    describe('proposeAmendment', () => {
      it('should create a new amendment', async () => {
        const amendment = await service.proposeAmendment(
          'Add new rule: agents must disclose model version',
          'agent-proposer-1',
        );

        expect(amendment.amendment_id).toBeDefined();
        expect(amendment.status).toBe('proposed');
        expect(amendment.proposer_id).toBe('agent-proposer-1');
        expect(amendment.discussion_deadline).toBeDefined();
        expect(amendment.voting_deadline).toBeDefined();
      });

      it('should set discussion and voting deadlines using whole-hour windows', async () => {
        const amendment = await service.proposeAmendment('Deadline precision', 'deadline-proposer');
        const createdAt = new Date(amendment.created_at).getTime();
        const discussionDeadline = new Date(amendment.discussion_deadline!).getTime();
        const votingDeadline = new Date(amendment.voting_deadline!).getTime();

        expect(discussionDeadline - createdAt).toBe(168 * 3600_000);
        expect(votingDeadline - createdAt).toBe(336 * 3600_000);
      });

      it('should set quorum to 75%', async () => {
        const amendment = await service.proposeAmendment('Test content', 'proposer-1');
        expect(amendment.quorum).toBe(0.75);
      });
    });

    describe('voteOnAmendment', () => {
      it('should record a vote', async () => {
        const amendment = await service.proposeAmendment('Test amendment', 'proposer-1');
        const voted = await service.voteOnAmendment(
          amendment.amendment_id,
          'voter-1',
          'approve',
          1.5,
          'Looks good',
        );

        expect(voted.votes.length).toBe(1);
        expect(voted.votes[0]!.decision).toBe('approve');
        expect(voted.votes[0]!.weight).toBe(1.5);
        expect(voted.votes[0]!.reason).toBe('Looks good');
      });

      it('should update approval rate', async () => {
        const amendment = await service.proposeAmendment('Test', 'p');
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);
        const result = await service.voteOnAmendment(amendment.amendment_id, 'v2', 'reject', 1);
        expect(result.approval_rate).toBeLessThan(1);
      });

      it('should throw for unknown amendment', async () => {
        await expect(
          service.voteOnAmendment('unknown-amendment', 'voter', 'approve', 1),
        ).rejects.toThrow(NotFoundError);
      });

      it('should throw for duplicate vote', async () => {
        const amendment = await service.proposeAmendment('Test', 'p');
        await service.voteOnAmendment(amendment.amendment_id, 'voter-dup', 'approve', 1);

        await expect(
          service.voteOnAmendment(amendment.amendment_id, 'voter-dup', 'reject', 1),
        ).rejects.toThrow(ConflictError);
      });
    });

    describe('ratifyAmendment', () => {
      it('should ratify amendment with sufficient votes', async () => {
        const amendment = await service.proposeAmendment('Test ratification', 'proposer-r');
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v2', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v3', 'approve', 1);

        const result = await service.ratifyAmendment(amendment.amendment_id);
        expect(result.amendment.status).toBe('ratified');
        expect(result.new_version.version).toBeGreaterThan(1);
        expect(result.new_version.amendment_id).toBe(amendment.amendment_id);
      });

      it('should persist the new constitution version after ratification', async () => {
        const amendment = await service.proposeAmendment('Persisted version change', 'proposer-persist');
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v2', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v3', 'approve', 1);

        const result = await service.ratifyAmendment(amendment.amendment_id);
        const version = await service.getConstitutionVersion();

        expect(version).toEqual(result.new_version);
      });

      it('should reject amendment below 75% approval', async () => {
        const amendment = await service.proposeAmendment('Test rejection', 'proposer-r2');
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v2', 'reject', 10);
        await service.voteOnAmendment(amendment.amendment_id, 'v3', 'reject', 10);

        await expect(service.ratifyAmendment(amendment.amendment_id)).rejects.toThrow(ValidationError);
      });

      it('should reject with insufficient votes', async () => {
        const amendment = await service.proposeAmendment('Low turnout', 'proposer-lt');
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);

        await expect(service.ratifyAmendment(amendment.amendment_id)).rejects.toThrow(
          ValidationError,
        );
      });
    });

    describe('getConstitutionVersion', () => {
      it('should return current constitution version', async () => {
        const version = await service.getConstitutionVersion();
        expect(version.version).toBeDefined();
        expect(version.hash).toBeDefined();
        expect(version.ratified_at).toBeDefined();
      });

      it('should reset to the genesis version between test runs', async () => {
        const version = await service.getConstitutionVersion();
        expect(version.version).toBe(1);
        expect(version.hash).toBe('genesis');
        expect(version.ratified_by).toBe('genesis_block');
      });
    });

    describe('listAmendments', () => {
      it('should list all amendments', async () => {
        await service.proposeAmendment('Amendment 1', 'p1');
        await service.proposeAmendment('Amendment 2', 'p2');
        const amendments = await service.listAmendments();
        expect(amendments.length).toBeGreaterThanOrEqual(2);
      });

      it('should filter by status', async () => {
        const amendments = await service.listAmendments({ status: 'proposed' });
        for (const a of amendments) {
          expect(a.status).toBe('proposed');
        }
      });

      it('should filter by proposer', async () => {
        await service.proposeAmendment('By specific proposer', 'unique-proposer');
        const amendments = await service.listAmendments({ proposer_id: 'unique-proposer' });
        expect(amendments.length).toBe(1);
        expect(amendments[0]!.proposer_id).toBe('unique-proposer');
      });

      it('should assign the next amendment version from the current constitution state', async () => {
        const first = await service.proposeAmendment('Sequential version one', 'version-proposer');
        await service.voteOnAmendment(first.amendment_id, 'v1', 'approve', 1);
        await service.voteOnAmendment(first.amendment_id, 'v2', 'approve', 1);
        await service.voteOnAmendment(first.amendment_id, 'v3', 'approve', 1);
        await service.ratifyAmendment(first.amendment_id);

        const second = await service.proposeAmendment('Sequential version two', 'version-proposer');

        expect(second.version).toBe(first.version + 1);
      });
    });

    describe('checkAmendmentCooldown', () => {
      it('should allow proposal for new proposer', async () => {
        const result = await service.checkAmendmentCooldown('brand-new-proposer');
        expect(result.can_propose).toBe(true);
      });

      it('should block proposal during cooldown after rejection', async () => {
        // Propose and get the amendment back from the map
        const amendment = await service.proposeAmendment('Will be rejected', 'cooldown-test');

        // Vote to get past discussion deadline (3 voters)
        await service.voteOnAmendment(amendment.amendment_id, 'v1', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v2', 'approve', 1);
        await service.voteOnAmendment(amendment.amendment_id, 'v3', 'reject', 1);

        // Manually set to rejected in the stored map
        const stored = await service.getAmendment(amendment.amendment_id);
        if (stored) {
          stored.status = 'rejected';
          stored.updated_at = new Date().toISOString();
        }

        // Should be in cooldown — can_propose is false
        const result = await service.checkAmendmentCooldown('cooldown-test');
        expect(result.can_propose).toBe(false);
        expect(result.cooldown_ends_at).toBeDefined();
      });
    });
  });

  describe('Conflict Detector', () => {
    describe('detectConflicts', () => {
      it('should detect redundancy between identical rules', async () => {
        // Register duplicate rules
        const rule1 = service.registerRule({
          name: 'Rule A',
          description: 'Must not publish malware',
          category: 'content_policy',
          severity: 'critical',
          enabled: true,
          priority: 80,
          condition: 'content_contains_malware',
          action: 'block',
        });

        const rule2 = service.registerRule({
          name: 'Rule B',
          description: 'Must not publish malware',
          category: 'content_policy',
          severity: 'critical',
          enabled: true,
          priority: 80,
          condition: 'content_contains_malware',
          action: 'block',
        });

        const conflicts = await service.detectConflicts();
        const redundancy = conflicts.find(
          c => (c.rule_a === rule1.rule_id && c.rule_b === rule2.rule_id) ||
               (c.rule_a === rule2.rule_id && c.rule_b === rule1.rule_id),
        );
        expect(redundancy).toBeDefined();
        expect(redundancy?.conflict_type).toBe('redundancy');
      });

      it('should return empty list when no conflicts', async () => {
        const conflicts = await service.detectConflicts({
          rule_id: 'rule-no-malware',
        });
        // Built-in rules don't have obvious conflicts with each other
        expect(Array.isArray(conflicts)).toBe(true);
      });
    });

    describe('resolveConflict', () => {
      it('should keep rule A when resolution is keep_a', async () => {
        const { rules } = service.listRules({ status: 'active' });
        const ruleA = rules[0]!;
        const ruleB = rules[1]!;

        const result = await service.resolveConflict(ruleA.rule_id, ruleB.rule_id, 'keep_a');
        expect(result.resolved_rules).toContain(ruleA.rule_id);
        expect(result.action).toContain('Kept rule');
      });

      it('should throw for unknown rules', async () => {
        await expect(
          service.resolveConflict('unknown-a', 'unknown-b', 'keep_a'),
        ).rejects.toThrow(NotFoundError);
      });
    });

    describe('suggestRulePriority', () => {
      it('should suggest critical rules get higher priority', async () => {
        const nonCritical = service.registerRule({
          name: 'Non-critical rule',
          description: 'Minor rule',
          category: 'agent_conduct',
          severity: 'low',
          enabled: true,
          priority: 20,
          condition: 'minor_offense',
          action: 'warn',
        });

        const critical = service.registerRule({
          name: 'Critical rule',
          description: 'Serious violation',
          category: 'content_policy',
          severity: 'critical',
          enabled: true,
          priority: 20,
          condition: 'major_offense',
          action: 'ban',
        });

        const suggestion = await service.suggestRulePriority(critical.rule_id, nonCritical.rule_id);
        expect(suggestion.suggestion).toBe('rule_a_higher');
        expect(suggestion.reasoning).toContain('critical');
      });

      it('should maintain current priorities for similar rules', async () => {
        const { rules } = service.listRules({ status: 'active' });
        const ruleA = rules[0]!;
        const ruleB = rules[1]!;

        const suggestion = await service.suggestRulePriority(ruleA.rule_id, ruleB.rule_id);
        expect(suggestion.suggestion).toBeDefined();
        expect(suggestion.reasoning).toBeDefined();
      });
    });
  });

  describe('Integration: evaluateAndRecord', () => {
    it('should evaluate action and record violations', async () => {
      const context = {
        agent_id: 'integration-agent',
        action: 'publish_bad_content',
        metadata: { tags: ['malware'] },
        timestamp: new Date().toISOString(),
      };

      const result = await service.evaluateAndRecord('publish', context);

      expect(result.evaluation.allowed).toBe(false);
      expect(result.evaluation.violations.length).toBeGreaterThan(0);
      expect(result.ethics.has_violation).toBe(true);
    });
  });

  describe('getAgentEthicsProfile', () => {
    it('should return complete ethics profile', async () => {
      const profile = await service.getAgentEthicsProfile('profile-test-agent');
      expect(profile.agent_id).toBe('profile-test-agent');
      expect(profile.score).toBeDefined();
      expect(profile.factors.transparency).toBeDefined();
      expect(profile.factors.fairness).toBeDefined();
      expect(profile.factors.safety).toBeDefined();
      expect(profile.factors.honesty).toBeDefined();
      expect(profile.last_evaluated_at).toBeDefined();
    });
  });
});
