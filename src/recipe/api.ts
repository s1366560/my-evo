/**
 * Recipe API Endpoints
 * Phase 5: Reusable agent capability recipes (prompt templates + config)
 *
 * Endpoints:
 * - POST /a2a/recipe           Create a new recipe
 * - GET  /a2a/recipe/list       List all recipes
 * - GET  /a2a/recipe/:id        Get recipe details
 * - POST /a2a/recipe/:id/rate   Rate a recipe
 * - GET  /a2a/recipe/:id/versions  List recipe versions
 */

import { Request, Response } from 'express';
import { RecipeEngine } from './engine.js';
import { RecipeCreate } from './types.js';

const engine = new RecipeEngine();

export const recipeApi = {
  // POST /a2a/recipe
  create: async (req: Request, res: Response) => {
    try {
      const create: RecipeCreate = req.body;
      const recipe = engine.create(create);
      res.json({ recipe });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/recipe/list
  list: async (req: Request, res: Response) => {
    try {
      const status = req.query.status as any;
      const recipes = engine.listRecipes(status);
      res.json({ recipes });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/recipe/:id
  get: async (req: Request, res: Response) => {
    try {
      const recipe = engine.getRecipe(req.params.id);
      if (!recipe) {
        res.status(404).json({ error: 'Recipe not found' });
        return;
      }
      res.json({ recipe });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/recipe/:id/publish
  publish: async (req: Request, res: Response) => {
    try {
      const recipe = engine.publish(req.params.id, req.body.sender_id);
      if (!recipe) {
        res.status(404).json({ error: 'Recipe not found or unauthorized' });
        return;
      }
      res.json({ recipe });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // PATCH /a2a/recipe/:id
  update: async (req: Request, res: Response) => {
    try {
      // For simplicity, we use fork to create a new version
      const forked = engine.fork(req.params.id, req.body.sender_id, req.body);
      if (!forked) {
        res.status(404).json({ error: 'Recipe not found or unauthorized' });
        return;
      }
      res.json({ recipe: forked });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/recipe/:id/archive
  archive: async (req: Request, res: Response) => {
    try {
      const recipe = engine.archive(req.params.id, req.body.sender_id);
      if (!recipe) {
        res.status(404).json({ error: 'Recipe not found or unauthorized' });
        return;
      }
      res.json({ recipe });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/recipe/:id/fork
  fork: async (req: Request, res: Response) => {
    try {
      const forked = engine.fork(req.params.id, req.body.sender_id, req.body.changes || {});
      if (!forked) {
        res.status(404).json({ error: 'Recipe not found' });
        return;
      }
      res.json({ recipe: forked });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/recipe/:id/express
  express: async (req: Request, res: Response) => {
    try {
      const ttl = req.body.ttl_seconds || 3600;
      const organism = engine.express(req.params.id, ttl);
      if (!organism) {
        res.status(404).json({ error: 'Recipe not found or not published' });
        return;
      }
      res.json({ organism });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // POST /a2a/organism/:id/express-gene
  expressGene: async (req: Request, res: Response) => {
    try {
      const organism = engine.expressGene(
        req.params.id,
        req.body.gene_asset_id,
        req.body.position,
        req.body.status,
        req.body.output
      );
      if (!organism) {
        res.status(404).json({ error: 'Organism not found or expired' });
        return;
      }
      res.json({
        organism,
        genes_expressed: organism.genes_expressed,
        genes_total_count: organism.genes_total_count,
        next_position: organism.current_position,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // PATCH /a2a/organism/:id
  updateOrganism: async (req: Request, res: Response) => {
    try {
      const status = req.body.status;
      let organism;
      if (status === 'completed') {
        organism = engine.complete(req.params.id);
      } else if (status === 'failed') {
        organism = engine.fail(req.params.id);
      } else {
        res.status(400).json({ error: 'Invalid status' });
        return;
      }
      if (!organism) {
        res.status(404).json({ error: 'Organism not found' });
        return;
      }
      res.json({ organism });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/recipe/stats
  stats: async (_req: Request, res: Response) => {
    try {
      const recipes = engine.listRecipes();
      const published = recipes.filter((r) => r.status === 'published').length;
      res.json({
        total_recipes: recipes.length,
        published_recipes: published,
        draft_recipes: recipes.length - published,
      });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/recipe/search
  search: async (req: Request, res: Response) => {
    try {
      const { q, limit = '20' } = req.query;
      if (!q || typeof q !== 'string') {
        res.status(400).json({ error: 'invalid_request', message: 'Missing search query "q"' });
        return;
      }
      const limitNum = Math.min(parseInt(limit as string) || 20, 100);
      const recipes = engine.searchRecipes(q, limitNum);
      res.json({ recipes, total: recipes.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },

  // GET /a2a/organism/active
  getActiveOrganisms: async (req: Request, res: Response) => {
    try {
      const { recipe_id } = req.query;
      let organisms = engine.listActiveOrganisms();
      if (recipe_id && typeof recipe_id === 'string') {
        organisms = organisms.filter((o) => o.recipe_id === recipe_id);
      }
      res.json({ organisms, total: organisms.length });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  },
};
