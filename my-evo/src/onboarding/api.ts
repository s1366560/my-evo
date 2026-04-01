/**
 * Onboarding API Endpoints
 * Implements GET /onboarding/agent and POST /onboarding/agent/complete
 */

import { Router, Request, Response } from 'express';
import { getOnboardingWizard, completeStep, resetOnboarding, getStep } from './engine';
import { CompleteStepPayload } from './types';

const router = Router();

/**
 * GET /onboarding/agent
 * Returns the interactive onboarding wizard for the requesting agent
 */
router.get('/', (req: Request, res: Response) => {
  try {
    // Get agent ID from header (set by auth middleware) or query param
    const agentId = (req.headers['x-node-id'] as string) || req.query.agent_id as string;
    
    if (!agentId) {
      res.status(400).json({
        error: 'missing_agent_id',
        message: 'Agent ID is required. Provide via X-Node-Id header or agent_id query param.',
      });
      return;
    }

    const wizard = getOnboardingWizard(agentId);
    res.json(wizard);
  } catch (error) {
    console.error('Onboarding wizard error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to load onboarding wizard' });
  }
});

/**
 * POST /onboarding/agent/complete
 * Mark a step as completed and advance to the next step
 */
router.post('/complete', (req: Request, res: Response) => {
  try {
    const agentId = (req.headers['x-node-id'] as string) || req.query.agent_id as string;
    
    if (!agentId) {
      res.status(400).json({
        error: 'missing_agent_id',
        message: 'Agent ID is required.',
      });
      return;
    }

    const { step } = req.body as CompleteStepPayload;
    
    if (!step || typeof step !== 'number') {
      res.status(400).json({
        error: 'invalid_step',
        message: 'Step number is required and must be a number.',
      });
      return;
    }

    const stepInfo = getStep(step);
    if (!stepInfo) {
      res.status(400).json({
        error: 'invalid_step',
        message: `Step ${step} does not exist. Valid steps are 1-4.`,
      });
      return;
    }

    const state = completeStep(agentId, step);
    const wizard = getOnboardingWizard(agentId);
    
    res.json({
      message: `Step ${step} completed: ${stepInfo.title}`,
      state,
      wizard,
    });
  } catch (error) {
    console.error('Complete step error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to complete step' });
  }
});

/**
 * POST /onboarding/agent/reset
 * Reset onboarding state (for testing or user request)
 */
router.post('/reset', (req: Request, res: Response) => {
  try {
    const agentId = (req.headers['x-node-id'] as string) || req.query.agent_id as string;
    
    if (!agentId) {
      res.status(400).json({
        error: 'missing_agent_id',
        message: 'Agent ID is required.',
      });
      return;
    }

    resetOnboarding(agentId);
    res.json({ message: 'Onboarding state reset successfully' });
  } catch (error) {
    console.error('Reset onboarding error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to reset onboarding' });
  }
});

/**
 * GET /onboarding/agent/step/:step
 * Get details for a specific step
 */
router.get('/step/:step', (req: Request, res: Response) => {
  try {
    const stepNumber = parseInt(req.params.step, 10);
    
    if (isNaN(stepNumber)) {
      res.status(400).json({
        error: 'invalid_step',
        message: 'Step number must be a number.',
      });
      return;
    }

    const step = getStep(stepNumber);
    if (!step) {
      res.status(404).json({
        error: 'step_not_found',
        message: `Step ${stepNumber} not found. Valid steps are 1-4.`,
      });
      return;
    }

    res.json(step);
  } catch (error) {
    console.error('Get step error:', error);
    res.status(500).json({ error: 'internal_error', message: 'Failed to get step' });
  }
});

export default router;
