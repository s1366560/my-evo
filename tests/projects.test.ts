// Official Projects Tests

import { ProjectEngine } from '../src/projects/engine';
import { ProjectStatus } from '../src/projects/types';

describe('ProjectEngine', () => {
  let engine: ProjectEngine;

  beforeEach(() => {
    engine = new ProjectEngine();
  });

  describe('propose', () => {
    it('creates a project with PROPOSED status', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Shared Testing Framework',
        description: 'Standardized testing framework',
        repo_name: 'shared-testing-framework',
        plan: '1. Define test interface\n2. Build runner\n3. Create example tests',
      });

      expect(project.id).toMatch(/^proj_/);
      expect(project.title).toBe('Shared Testing Framework');
      expect(project.status).toBe(ProjectStatus.PROPOSED);
      expect(project.proposer_id).toBe('node-1');
    });
  });

  describe('getProject', () => {
    it('returns project by id', () => {
      const created = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test project',
        repo_name: 'test',
        plan: 'Test',
      });

      const found = engine.getProject(created.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(created.id);
    });

    it('returns null for non-existent project', () => {
      const found = engine.getProject('non-existent');
      expect(found).toBeNull();
    });
  });

  describe('listProjects', () => {
    it('lists all projects without filter', () => {
      engine.propose({
        sender_id: 'node-1',
        title: 'Project 1',
        description: 'Desc 1',
        repo_name: 'repo1',
        plan: 'Plan 1',
      });
      engine.propose({
        sender_id: 'node-2',
        title: 'Project 2',
        description: 'Desc 2',
        repo_name: 'repo2',
        plan: 'Plan 2',
      });

      const projects = engine.listProjects();
      expect(projects).toHaveLength(2);
    });

    it('filters projects by status', () => {
      const proposed = engine.propose({
        sender_id: 'node-1',
        title: 'Proposed',
        description: 'Desc',
        repo_name: 'repo1',
        plan: 'Plan',
      });

      const active = engine.propose({
        sender_id: 'node-1',
        title: 'Active',
        description: 'Desc',
        repo_name: 'repo2',
        plan: 'Plan',
      });

      engine.activate(active.id);

      const activeProjects = engine.listProjects(ProjectStatus.ACTIVE);
      expect(activeProjects).toHaveLength(1);
      // The activated project is the one titled 'Active' (was activated via activate())
      expect(activeProjects[0].title).toBe('Active');
    });
  });

  describe('submitToCouncil', () => {
    it('changes status to COUNCIL_REVIEW', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      const result = engine.submitToCouncil(project.id, 'council-session-1');

      expect(result).not.toBeNull();
      expect(result!.status).toBe(ProjectStatus.COUNCIL_REVIEW);
      expect(result!.council_session_id).toBe('council-session-1');
    });
  });

  describe('approve and activate', () => {
    it('transitions through approval lifecycle', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      engine.submitToCouncil(project.id, 'council-1');
      const approved = engine.approve(project.id);
      expect(approved!.status).toBe(ProjectStatus.APPROVED);

      const activated = engine.activate(project.id);
      expect(activated!.status).toBe(ProjectStatus.ACTIVE);
    });
  });

  describe('contribute', () => {
    it('adds contribution to project', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      const contribution = engine.contribute(
        project.id,
        'node-2',
        [{ path: 'src/index.js', content: 'console.log("hello")', action: 'create' }],
        'feat: add hello world'
      );

      expect(contribution).not.toBeNull();
      expect(contribution!.status).toBe('pending');
      expect(contribution!.files).toHaveLength(1);
    });
  });

  describe('approveContribution', () => {
    it('approves a pending contribution', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      const contribution = engine.contribute(
        project.id,
        'node-2',
        [{ path: 'src/index.js', content: 'code', action: 'create' }],
        'commit'
      );

      const approved = engine.approveContribution(project.id, contribution!.id, 'council-member-1');

      expect(approved).not.toBeNull();
      expect(approved!.status).toBe('approved');
      expect(approved!.reviewed_by).toBe('council-member-1');
    });
  });

  describe('decompose', () => {
    it('creates tasks from decomposition', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      const tasks = engine.decompose(project.id, [
        { title: 'Task 1', description: 'First task' },
        { title: 'Task 2', description: 'Second task' },
      ]);

      expect(tasks).toHaveLength(2);
      expect(tasks![0].title).toBe('Task 1');
      expect(tasks![1].title).toBe('Task 2');
    });
  });

  describe('complete and archive', () => {
    it('completes and archives a project', () => {
      const project = engine.propose({
        sender_id: 'node-1',
        title: 'Test',
        description: 'Test',
        repo_name: 'test',
        plan: 'Plan',
      });

      const completed = engine.complete(project.id);
      expect(completed!.status).toBe(ProjectStatus.COMPLETED);

      const archived = engine.archive(project.id);
      expect(archived!.status).toBe(ProjectStatus.ARCHIVED);
    });
  });
});
