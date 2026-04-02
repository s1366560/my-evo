// Skill Store API — Chapter 31
// 4-layer security moderation, 5 credits per download, authors earn 100% revenue

import { Request, Response } from 'express';
import { SkillStoreEngine } from './engine';
import { SkillStatus } from './types';
import type { SkillCreate } from './types';

const engine = new SkillStoreEngine();

export const skillStoreApi = {
  // GET /a2a/skill/store/status — Hub status
  status: async (_req: Request, res: Response) => {
    try {
      const status = engine.getHubStatus();
      res.json({ status });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/skill/store/list — List approved skills
  list: async (req: Request, res: Response) => {
    try {
      const { category, query, sort, limit, cursor } = req.query;
      const result = engine.listSkills({
        category: category as string,
        query: query as string,
        sort: (sort as any) || 'popular',
        limit: limit ? parseInt(limit as string) : 20,
        cursor: cursor as string,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/skill/store/:skillId — Skill detail
  get: async (req: Request, res: Response) => {
    try {
      const skill = engine.getSkill(req.params.skillId);
      if (!skill) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      // Never expose content in detail (use download for content)
      const { content, moderation, ...publicSkill } = skill;
      void content;
      void moderation;
      res.json({ skill: publicSkill });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/publish — Publish a new skill (requires auth)
  publish: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const create: SkillCreate = {
        ...req.body,
        sender_id: nodeId,
      };

      if (!create.title || !create.description || !create.content) {
        res.status(400).json({ error: 'title, description, and content are required' });
        return;
      }

      if (create.content.length > 50000) {
        res.status(400).json({ error: 'Content exceeds 50,000 character limit' });
        return;
      }

      const skill = await engine.publishSkill(create);

      // Return full skill (with moderation results for transparency)
      res.status(201).json({
        skill,
        moderation_passed: skill.status === SkillStatus.APPROVED,
        layers_passed: skill.moderation.length,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/:skillId/download — Download skill content (5 credits)
  download: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const result = await engine.downloadSkill(req.params.skillId, nodeId);
      if (!result) {
        res.status(404).json({ error: 'Skill not found or not approved' });
        return;
      }

      const skill = engine.getSkill(req.params.skillId)!;
      res.json({
        skill_id: skill.id,
        name: skill.title,
        version: skill.version,
        content: result.content,
        bundled_files: result.bundled_files,
        license: result.license,
        credit_cost: result.credit_cost,
        author_revenue: result.author_revenue,
        already_purchased: result.already_purchased,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/:skillId/rate — Rate a skill (1-5)
  rate: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }

      const rating = parseInt(req.body.rating);
      if (![1, 2, 3, 4, 5].includes(rating)) {
        res.status(400).json({ error: 'Rating must be 1-5' });
        return;
      }

      const success = engine.rateSkill(req.params.skillId, rating);
      if (!success) {
        res.status(404).json({ error: 'Skill not found or not approved' });
        return;
      }

      res.json({ success: true, rating });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/skill/store/:skillId/versions — Version history
  versions: async (req: Request, res: Response) => {
    try {
      const versions = engine.getVersions(req.params.skillId);
      if (!versions) {
        res.status(404).json({ error: 'Skill not found' });
        return;
      }
      res.json({ versions });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // PUT /a2a/skill/store/update — Update skill to new version
  update: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id, title, description, content, version } = req.body;
      if (!skill_id) {
        res.status(400).json({ error: 'skill_id is required' });
        return;
      }
      const result = await engine.updateSkill(skill_id, nodeId, { title, description, content, version });
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, skill: result.skill });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/rollback — Rollback to version
  rollback: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id, target_version } = req.body;
      if (!skill_id || !target_version) {
        res.status(400).json({ error: 'skill_id and target_version are required' });
        return;
      }
      const result = await engine.rollbackSkill(skill_id, nodeId, target_version);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, skill: result.skill });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/delete-version — Delete non-current version
  deleteVersion: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id, target_version } = req.body;
      if (!skill_id || !target_version) {
        res.status(400).json({ error: 'skill_id and target_version are required' });
        return;
      }
      const result = engine.deleteVersion(skill_id, nodeId, target_version);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/delete — Soft delete
  delete: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id } = req.body;
      if (!skill_id) {
        res.status(400).json({ error: 'skill_id is required' });
        return;
      }
      const result = engine.softDelete(skill_id, nodeId);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, message: 'Skill moved to recycle bin' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/restore — Restore from recycle bin
  restore: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id } = req.body;
      if (!skill_id) {
        res.status(400).json({ error: 'skill_id is required' });
        return;
      }
      const result = engine.restore(skill_id, nodeId);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, skill: result.skill });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/recycle-bin — List recycle bin
  recycleBin: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const skills = engine.listRecycleBin(nodeId);
      res.json({ skills, total: skills.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/skill/store/permanent-delete — Permanently delete
  permanentDelete: async (req: Request, res: Response) => {
    try {
      const nodeId = (req as any).nodeId;
      if (!nodeId) {
        res.status(401).json({ error: 'unauthorized' });
        return;
      }
      const { skill_id } = req.body;
      if (!skill_id) {
        res.status(400).json({ error: 'skill_id is required' });
        return;
      }
      const result = engine.permanentDelete(skill_id, nodeId);
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ success: true, message: 'Skill permanently deleted' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
};
