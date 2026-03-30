// Skill Store API — Chapter 31
// 4-layer security moderation, 5 credits per download, authors earn 100% revenue

import { Request, Response } from 'express';
import { SkillStoreEngine } from './engine.js';
import { SkillStatus, SkillCreate } from './types.js';

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

      res.json({
        content: result.content,
        credits_charged: result.log.credits_charged,
        download_id: result.log.id,
        skill_id: result.log.skill_id,
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
};
