// EvoMap Node - Main Entry Point
// Implements GEP-A2A protocol with Swarm and Recipe/Organism systems

import express, { Request, Response } from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

import { SwarmEngine } from './swarm/engine.js';
import { SwarmAPI } from './swarm/api.js';
import { RecipeEngine, RecipeState, OrganismState } from './recipe/engine.js';

// Config
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '..', 'config.json');

interface Config {
  node_id: string;
  node_secret: string;
  hub_url: string;
  port?: number;
}

function loadConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      node_id: `node_${uuidv4().replace(/-/g, '').slice(0, 16)}`,
      node_secret: crypto.randomBytes(32).toString('hex'),
      hub_url: 'https://evomap.ai',
      port: 3000
    };
  }
}

const config = loadConfig();

// Initialize engines
const swarmEngine = new SwarmEngine();
const swarmAPI = new SwarmAPI(swarmEngine);
const recipeEngine = new RecipeEngine();

// Express app
const app = express();
app.use(express.json());

// Auth middleware
function auth(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || token !== config.node_secret) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid or missing node_secret' });
  }
  next();
}

// ============ Swarm Endpoints ============

// POST /a2a/swarm/create
app.post('/a2a/swarm/create', auth, (req: Request, res: Response) => {
  const { title, description, mode, sub_tasks, auto_approved, timeout_ms, deadline } = req.body;
  if (!title || !description || !mode) {
    return res.status(400).json({ error: 'missing_fields', message: 'title, description, mode required' });
  }
  const swarm_id = `swarm_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const result = swarmAPI.createSwarm(swarm_id, config.node_id, {
    title, description, mode, sub_tasks, auto_approved, timeout_ms, deadline
  });
  res.json(result);
});

// GET /a2a/swarm/:id
app.get('/a2a/swarm/:id', auth, (req: Request, res: Response) => {
  const result = swarmAPI.getSwarm(req.params.id);
  if (result.error) return res.status(404).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/propose
app.post('/a2a/swarm/:id/propose', auth, (req: Request, res: Response) => {
  const { decomposition } = req.body;
  if (!decomposition) return res.status(400).json({ error: 'missing_fields', message: 'decomposition required' });
  const result = swarmAPI.proposeDecomposition(req.params.id, config.node_id, { decomposition });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/approve
app.post('/a2a/swarm/:id/approve', auth, (req: Request, res: Response) => {
  const result = swarmAPI.approveDecomposition(req.params.id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/join
app.post('/a2a/swarm/:id/join', auth, (req: Request, res: Response) => {
  const { sub_task_id, solver_id } = req.body;
  if (!sub_task_id || !solver_id) return res.status(400).json({ error: 'missing_fields', message: 'sub_task_id, solver_id required' });
  const result = swarmAPI.joinSwarm(req.params.id, { sub_task_id, solver_id });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/solve
app.post('/a2a/swarm/:id/solve', auth, (req: Request, res: Response) => {
  const { sub_task_id, solver_id, solution } = req.body;
  if (!sub_task_id || !solver_id || solution === undefined) {
    return res.status(400).json({ error: 'missing_fields', message: 'sub_task_id, solver_id, solution required' });
  }
  const result = swarmAPI.solveSubTask(req.params.id, { sub_task_id, solver_id, solution });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/aggregate
app.post('/a2a/swarm/:id/aggregate', auth, (req: Request, res: Response) => {
  const { aggregator_id, aggregated_result } = req.body;
  if (!aggregator_id || !aggregated_result) {
    return res.status(400).json({ error: 'missing_fields', message: 'aggregator_id, aggregated_result required' });
  }
  const result = swarmAPI.aggregate(req.params.id, { aggregator_id, aggregated_result });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/perspective (DC mode)
app.post('/a2a/swarm/:id/perspective', auth, (req: Request, res: Response) => {
  const { solver_id, perspective } = req.body;
  if (!solver_id || !perspective) {
    return res.status(400).json({ error: 'missing_fields', message: 'solver_id, perspective required' });
  }
  const result = swarmAPI.submitPerspective(req.params.id, { solver_id, perspective });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/converge (DC mode)
app.post('/a2a/swarm/:id/converge', auth, (req: Request, res: Response) => {
  const { aggregator_id, converged_result } = req.body;
  if (!aggregator_id || !converged_result) {
    return res.status(400).json({ error: 'missing_fields', message: 'aggregator_id, converged_result required' });
  }
  const result = swarmAPI.converge(req.params.id, { aggregator_id, converged_result });
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// POST /a2a/swarm/:id/cancel
app.post('/a2a/swarm/:id/cancel', auth, (req: Request, res: Response) => {
  const result = swarmAPI.cancelSwarm(req.params.id, config.node_id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// GET /a2a/swarm (list all)
app.get('/a2a/swarm', auth, (req: Request, res: Response) => {
  res.json({ swarms: swarmEngine.listSwarms() });
});

// ============ Recipe Endpoints ============

// POST /a2a/recipe/create
app.post('/a2a/recipe/create', auth, (req: Request, res: Response) => {
  const { title, description, genes, constraints } = req.body;
  if (!title || !description || !genes) {
    return res.status(400).json({ error: 'missing_fields', message: 'title, description, genes required' });
  }
  const recipe_id = `recipe_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const result = recipeEngine.createRecipe({ id: recipe_id, title, description, genes, constraints, author_id: config.node_id });
  res.json({ recipe: result });
});

// GET /a2a/recipe/:id
app.get('/a2a/recipe/:id', auth, (req: Request, res: Response) => {
  const recipe = recipeEngine.getRecipe(req.params.id);
  if (!recipe) return res.status(404).json({ error: 'not_found' });
  res.json({ recipe });
});

// POST /a2a/recipe/:id/publish
app.post('/a2a/recipe/:id/publish', auth, (req: Request, res: Response) => {
  const result = recipeEngine.publishRecipe(req.params.id);
  if (!result) return res.status(400).json({ error: 'publish_failed', message: 'Recipe not found or not in DRAFT state' });
  res.json({ recipe: result });
});

// POST /a2a/recipe/:id/version
app.post('/a2a/recipe/:id/version', auth, (req: Request, res: Response) => {
  const { genes, constraints } = req.body;
  const result = recipeEngine.versionRecipe(req.params.id, genes, constraints);
  if (!result) return res.status(400).json({ error: 'version_failed' });
  res.json({ recipe: result });
});

// POST /a2a/recipe/:id/instantiate
app.post('/a2a/recipe/:id/instantiate', auth, (req: Request, res: Response) => {
  const { context } = req.body;
  if (!context) return res.status(400).json({ error: 'missing_fields', message: 'context required' });
  const organism_id = `org_${uuidv4().replace(/-/g, '').slice(0, 16)}`;
  const result = recipeEngine.instantiate(req.params.id, organism_id, context, config.node_id);
  if (!result) return res.status(400).json({ error: 'instantiate_failed', message: 'Recipe not found or not available' });
  res.json({ organism: result });
});

// GET /a2a/organism/:id
app.get('/a2a/organism/:id', auth, (req: Request, res: Response) => {
  const organism = recipeEngine.getOrganism(req.params.id);
  if (!organism) return res.status(404).json({ error: 'not_found' });
  res.json({ organism });
});

// POST /a2a/organism/:id/start
app.post('/a2a/organism/:id/start', auth, (req: Request, res: Response) => {
  const result = recipeEngine.startOrganism(req.params.id);
  if (!result) return res.status(400).json({ error: 'start_failed' });
  res.json({ organism: result });
});

// POST /a2a/organism/:id/step
app.post('/a2a/organism/:id/step', auth, (req: Request, res: Response) => {
  const { step_result } = req.body;
  const result = recipeEngine.runStep(req.params.id, step_result);
  if (!result) return res.status(400).json({ error: 'step_failed' });
  res.json({ organism: result });
});

// POST /a2a/organism/:id/rollback
app.post('/a2a/organism/:id/rollback', auth, (req: Request, res: Response) => {
  const { checkpoint_id } = req.body;
  if (!checkpoint_id) return res.status(400).json({ error: 'missing_fields', message: 'checkpoint_id required' });
  const result = recipeEngine.rollbackToCheckpoint(req.params.id, checkpoint_id);
  if (!result) return res.status(400).json({ error: 'rollback_failed' });
  res.json({ organism: result });
});

// GET /a2a/recipes (list published)
app.get('/a2a/recipes', auth, (req: Request, res: Response) => {
  res.json({ recipes: recipeEngine.listPublishedRecipes() });
});

// ============ Node Endpoints ============

// GET /a2a/node/status
app.get('/a2a/node/status', (req: Request, res: Response) => {
  res.json({
    node_id: config.node_id,
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    capabilities: ['swarm', 'recipe', 'gene', 'capsule']
  });
});

// GET /health
app.get('/health', (req: Request, res: Response) => {
  const timedOut = swarmAPI.checkTimeouts();
  res.json({
    status: 'ok',
    node_id: config.node_id,
    swarms_active: swarmEngine.listSwarms().filter(s => !['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(s.state)).length,
    swarms_timed_out: timedOut.length,
    organisms_active: recipeEngine.listOrganisms(OrganismState.RUNNING).length
  });
});

// Start server
const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`EvoMap Node running on port ${PORT}`);
  console.log(`Node ID: ${config.node_id}`);
  console.log(`Hub: ${config.hub_url}`);
});

export { app, config, swarmEngine, recipeEngine };
