/**
 * Skill Store API Router
 * Section 31: Skill Store endpoints
 * - GET  /a2a/skill/store/status        - Check if Skill Store is enabled
 * - GET  /a2a/skill/store/list          - List published Skills (paginated)
 * - GET  /a2a/skill/store/:skillId     - Skill detail (preview + structure)
 * - GET  /a2a/skill/store/:skillId/versions - Version history
 * - POST /a2a/skill/store/publish      - Publish a new Skill
 * - PUT  /a2a/skill/store/update       - Update with new version
 * - POST /a2a/skill/store/visibility   - Toggle private/public
 * - POST /a2a/skill/store/rollback     - Rollback to a previous version
 * - POST /a2a/skill/store/delete-version - Delete a non-current version
 * - POST /a2a/skill/store/delete       - Soft-delete (recycle bin)
 * - POST /a2a/skill/store/restore      - Restore from recycle bin
 * - POST /a2a/skill/store/recycle-bin  - List recycled Skills
 * - POST /a2a/skill/store/permanent-delete - Permanently delete
 * - POST /a2a/skill/store/:skillId/download - Download full content (5 credits)
 */

import { Router, Request, Response } from 'express';
import {
  createSkill,
  getSkill,
  getSkillFull,
  listSkills,
  downloadSkill,
  rateSkill,
  getSkillStats,
  updateSkill,
  deleteSkill,
  restoreSkill,
  getVersions,
  rollbackSkill,
  getRecycleBin,
  toggleVisibility,
} from './engine';
import type { Skill } from './types';

const router = Router();

// Auth helper
function requireAuth(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

// Validate node secret (placeholder - use real validation in production)
function validateNodeSecret(_secret: string): string | null {
  // In production, this would look up the node by secret
  return 'node_authenticated';
}

// GET /a2a/skill/store/status
router.get('/status', (_req: Request, res: Response) => {
  const stats = getSkillStats();
  res.json({
    enabled: true,
    skill_store_url: '/a2a/skill/store',
    stats,
    pricing: {
      download_cost: 5,
      author_revenue_share: '100%',
    },
  });
});

// GET /a2a/skill/store/list
router.get('/list', (req: Request, res: Response) => {
  try {
    const { keyword, category, tag, sort, page, limit } = req.query;
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(50, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const result = listSkills({
      query: keyword as string,
      category: category as string,
      limit: limitNum + 1, // fetch one extra to check if there's a next page
      cursor: undefined,
    });

    // Simple pagination
    const skills = result.skills.slice(0, limitNum);
    const hasMore = result.skills.length > limitNum;

    res.json({
      skills,
      total: skills.length,
      page: pageNum,
      limit: limitNum,
      has_more: hasMore,
      sort: sort || 'newest',
    });
  } catch (error) {
    console.error('Skill list error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to list skills' });
  }
});

// GET /a2a/skill/store/:skillId
router.get('/:skillId', (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const auth = requireAuth(req);

    const skill = auth
      ? getSkillFull(skillId, validateNodeSecret(auth) || '')
      : getSkill(skillId);

    if (!skill) {
      res.status(404).json({ error: 'not_found', message: `Skill ${skillId} not found` });
      return;
    }

    res.json({ skill });
  } catch (error) {
    console.error('Skill get error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get skill' });
  }
});

// GET /a2a/skill/store/:skillId/versions
router.get('/:skillId/versions', (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const versions = getVersions(skillId);
    if (!versions) {
      res.status(404).json({ error: 'not_found', message: `Skill ${skillId} not found` });
      return;
    }
    res.json({ skill_id: skillId, versions });
  } catch (error) {
    console.error('Skill versions error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get versions' });
  }
});

// POST /a2a/skill/store/publish
router.post('/publish', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { title, description, content, category, tags, price } = req.body;

    // Validation
    if (!title || title.length < 2 || title.length > 64) {
      res.status(400).json({ error: 'invalid_request', message: 'title must be 2-64 characters' });
      return;
    }
    if (!description || description.length < 10 || description.length > 1024) {
      res.status(400).json({ error: 'invalid_request', message: 'description must be 10-1024 characters' });
      return;
    }
    if (!content || content.length < 500) {
      res.status(400).json({ error: 'invalid_request', message: 'content must be at least 500 characters' });
      return;
    }
    if (!category || !['repair', 'optimize', 'innovate'].includes(category)) {
      res.status(400).json({ error: 'invalid_request', message: 'category must be repair, optimize, or innovate' });
      return;
    }

    const skill = createSkill(
      nodeId,
      title,
      description,
      category,
      tags || [],
      content,
      price
    );

    const moderationResult = skill.status === 'published'
      ? { passed: true, layers_passed: skill.security_layers_passed }
      : { passed: false, layers_passed: skill.security_layers_passed, flags: skill.moderation_flags };

    res.status(201).json({
      status: 'published',
      skill_id: skill.skill_id,
      moderation: moderationResult,
    });
  } catch (error) {
    console.error('Skill publish error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to publish skill' });
  }
});

// PUT /a2a/skill/store/update
router.put('/update', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id, title, description, content, category, tags, price } = req.body;

    if (!skill_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id is required' });
      return;
    }

    const updated = updateSkill(skill_id, nodeId, {
      title,
      description,
      content,
      category,
      tags,
      price,
    });

    if (!updated) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found or not authorized' });
      return;
    }

    res.json({ status: 'updated', skill: updated });
  } catch (error) {
    console.error('Skill update error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update skill' });
  }
});

// POST /a2a/skill/store/visibility
router.post('/visibility', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id, visibility } = req.body;
    if (!skill_id || !visibility) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id and visibility are required' });
      return;
    }

    const result = toggleVisibility(skill_id, nodeId, visibility);
    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found or not authorized' });
      return;
    }

    res.json({ status: 'visibility_updated', skill_id, visibility });
  } catch (error) {
    console.error('Skill visibility error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to update visibility' });
  }
});

// POST /a2a/skill/store/rollback
router.post('/rollback', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id, version_id } = req.body;
    if (!skill_id || !version_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id and version_id are required' });
      return;
    }

    const result = rollbackSkill(skill_id, version_id, nodeId);
    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Skill or version not found' });
      return;
    }

    res.json({ status: 'rolled_back', skill: result });
  } catch (error) {
    console.error('Skill rollback error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to rollback skill' });
  }
});

// POST /a2a/skill/store/delete-version
router.post('/delete-version', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id, version_id } = req.body;
    if (!skill_id || !version_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id and version_id are required' });
      return;
    }

    // Soft delete a specific version
    const success = deleteSkill(skill_id, nodeId, version_id);
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'Skill or version not found' });
      return;
    }

    res.json({ status: 'version_deleted', skill_id, version_id });
  } catch (error) {
    console.error('Skill delete-version error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete version' });
  }
});

// POST /a2a/skill/store/delete
router.post('/delete', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id } = req.body;
    if (!skill_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id is required' });
      return;
    }

    const result = deleteSkill(skill_id, nodeId);
    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found or not authorized' });
      return;
    }

    res.json({ status: 'deleted', skill_id, deleted_at: new Date().toISOString() });
  } catch (error) {
    console.error('Skill delete error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to delete skill' });
  }
});

// POST /a2a/skill/store/restore
router.post('/restore', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id } = req.body;
    if (!skill_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id is required' });
      return;
    }

    const result = restoreSkill(skill_id, nodeId);
    if (!result) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found in recycle bin or not authorized' });
      return;
    }

    res.json({ status: 'restored', skill_id });
  } catch (error) {
    console.error('Skill restore error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to restore skill' });
  }
});

// POST /a2a/skill/store/recycle-bin
router.post('/recycle-bin', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const result = getRecycleBin(nodeId);
    res.json({ skills: result, total: result.length });
  } catch (error) {
    console.error('Recycle bin error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get recycle bin' });
  }
});

// POST /a2a/skill/store/permanent-delete
router.post('/permanent-delete', (req: Request, res: Response) => {
  try {
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const { skill_id } = req.body;
    if (!skill_id) {
      res.status(400).json({ error: 'invalid_request', message: 'skill_id is required' });
      return;
    }

    // Permanent delete - this would remove from recycle bin permanently
    const skill = (global as any).__skill_store_recycle?.get(skill_id);
    if (!skill || skill.author_id !== nodeId) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found in recycle bin or not authorized' });
      return;
    }

    (global as any).__skill_store_recycle?.delete(skill_id);
    res.json({ status: 'permanently_deleted', skill_id });
  } catch (error) {
    console.error('Permanent delete error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to permanently delete skill' });
  }
});

// POST /a2a/skill/store/:skillId/download
router.post('/:skillId/download', (req: Request, res: Response) => {
  try {
    const { skillId } = req.params;
    const auth = requireAuth(req);
    if (!auth) {
      res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
      return;
    }
    const nodeId = validateNodeSecret(auth);
    if (!nodeId) {
      res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
      return;
    }

    const download = downloadSkill(skillId, nodeId);
    if (!download) {
      res.status(404).json({ error: 'not_found', message: 'Skill not found or insufficient credits' });
      return;
    }

    const skill = getSkillFull(skillId, nodeId);

    // Check if already purchased
    const alreadyPurchased = download.credits_charged === 0;

    res.json({
      skill_id: skill?.skill_id,
      name: skill?.title,
      version: '1.0.0',
      content: skill?.content,
      bundled_files: [],
      license: 'EvoMap Skill License (ESL-1.0)',
      credit_cost: alreadyPurchased ? 0 : 5,
      author_revenue: alreadyPurchased ? 0 : 5,
      already_purchased: alreadyPurchased,
    });
  } catch (error) {
    console.error('Skill download error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to download skill' });
  }
});

export default router;
