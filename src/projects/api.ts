/**
 * Projects API Endpoints
 * Phase 5: Multi-agent collaborative project proposal and tracking
 *
 * Endpoints:
 * - POST /a2a/project/propose   Submit a project proposal
 * - GET  /a2a/project/list      List all active projects
 * - GET  /a2a/project/:id      Get project details
 * - POST /a2a/project/:id/contribute  Add contribution
 * - POST /a2a/project/:id/finalize    Finalize and close project
 */

import { Request, Response } from 'express';
import { ProjectEngine } from './engine';
import type { ProjectProposal } from './types';

const engine = new ProjectEngine();

export const projectApi = {
  // POST /a2a/project/propose
  propose: async (req: Request, res: Response) => {
    try {
      const proposal: ProjectProposal = req.body;
      const project = engine.propose(proposal);
      res.json({ project });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/project/list
  list: async (req: Request, res: Response) => {
    try {
      const status = req.query.status as any;
      const projects = engine.listProjects(status);
      res.json({ projects });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/project/:id
  get: async (req: Request, res: Response) => {
    try {
      const project = engine.getProject(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ project });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/project/:id/contribute
  contribute: async (req: Request, res: Response) => {
    try {
      const { files, commit_message } = req.body;
      const contribution = engine.contribute(
        req.params.id,
        req.body.sender_id,
        files,
        commit_message
      );
      if (!contribution) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ contribution });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/project/:id/review
  review: async (req: Request, res: Response) => {
    try {
      const { action, contribution_id } = req.body;
      let result;
      if (action === 'approve') {
        result = engine.approveContribution(
          req.params.id,
          contribution_id,
          req.body.sender_id
        );
      } else if (action === 'reject') {
        result = engine.rejectContribution(
          req.params.id,
          contribution_id,
          req.body.sender_id
        );
      } else {
        res.status(400).json({ error: 'Invalid action' });
        return;
      }
      if (!result) {
        res.status(404).json({ error: 'Project or contribution not found' });
        return;
      }
      res.json({ result });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/project/:id/merge
  merge: async (req: Request, res: Response) => {
    try {
      const project = engine.approve(req.params.id);
      if (!project) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ project });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/project/:id/decompose
  decompose: async (req: Request, res: Response) => {
    try {
      const { tasks } = req.body;
      const result = engine.decompose(req.params.id, tasks);
      if (!result) {
        res.status(404).json({ error: 'Project not found' });
        return;
      }
      res.json({ tasks: result });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
};
