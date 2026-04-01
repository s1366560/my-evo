import { Router, Request, Response } from 'express';
import * as council from './engine';
import type { CouncilConfig, CouncilProposal } from './types';

const router = Router();

// POST /a2a/council/propose
router.post('/propose', (req: Request, res: Response) => {
  try {
    const { type, title, description, proposer, ...options } = req.body;

    if (!type || !title || !description || !proposer) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: type, title, description, proposer',
      });
      return;
    }

    const proposal = council.createProposal(type, title, description, proposer, options);
    res.json({ status: 'acknowledged', proposal_id: proposal.proposal_id, expires_at: proposal.expires_at });
  } catch (error) {
    console.error('Council propose error:', error);
    res.status(500).json({ error: 'proposal_failed', message: String(error) });
  }
});

// POST /a2a/council/vote
router.post('/vote', (req: Request, res: Response) => {
  try {
    const { proposal_id, voter_id, vote, reason } = req.body;

    if (!proposal_id || !voter_id || !vote) {
      res.status(400).json({
        error: 'invalid_request',
        message: 'Missing required fields: proposal_id, voter_id, vote',
      });
      return;
    }

    if (!['approve', 'reject', 'abstain'].includes(vote)) {
      res.status(400).json({ error: 'invalid_vote', message: 'Vote must be: approve, reject, or abstain' });
      return;
    }

    const councilVote = council.castVote(proposal_id, voter_id, vote, reason);
    res.json({ status: 'acknowledged', vote: councilVote });
  } catch (error) {
    console.error('Council vote error:', error);
    res.status(400).json({ error: 'vote_failed', message: String(error) });
  }
});

// GET /a2a/council/proposal/:id
router.get('/proposal/:id', (req: Request, res: Response) => {
  try {
    const proposal = council.getProposal(req.params.id);
    if (!proposal) {
      res.status(404).json({ error: 'not_found', message: 'Proposal not found' });
      return;
    }
    res.json(proposal);
  } catch (error) {
    console.error('Get proposal error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /a2a/council/proposals
router.get('/proposals', (req: Request, res: Response) => {
  try {
    const { status, type, limit } = req.query;
    const proposals = council.listProposals({
      status: status as any,
      type: type as any,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    res.json({ proposals });
  } catch (error) {
    console.error('List proposals error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// POST /a2a/council/finalize
router.post('/finalize', (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing proposal_id' });
      return;
    }
    const newStatus = council.finalizeProposal(proposal_id);
    res.json({ status: 'acknowledged', new_status: newStatus });
  } catch (error) {
    console.error('Finalize proposal error:', error);
    res.status(400).json({ error: 'finalize_failed', message: String(error) });
  }
});

// POST /a2a/council/execute
router.post('/execute', (req: Request, res: Response) => {
  try {
    const { proposal_id } = req.body;
    if (!proposal_id) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing proposal_id' });
      return;
    }
    council.executeProposal(proposal_id);
    res.json({ status: 'executed', proposal_id });
  } catch (error) {
    console.error('Execute proposal error:', error);
    res.status(400).json({ error: 'execute_failed', message: String(error) });
  }
});

// GET /a2a/council/config
router.get('/config', (_req: Request, res: Response) => {
  res.json(council.getConfig());
});

// POST /a2a/council/resolve-dispute
router.post('/resolve-dispute', (req: Request, res: Response) => {
  try {
    const { bounty_id, verdict } = req.body;
    if (!bounty_id || !verdict) {
      res.status(400).json({ error: 'invalid_request', message: 'Missing required fields: bounty_id, verdict' });
      return;
    }

    if (!['favor_creator', 'favor_worker', 'split', 'void'].includes(verdict)) {
      res.status(400).json({ error: 'invalid_verdict', message: 'Verdict must be: favor_creator, favor_worker, split, or void' });
      return;
    }

    const decision = council.resolveBountyDispute(bounty_id, verdict);
    res.json({ status: 'resolved', decision });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(400).json({ error: 'resolve_failed', message: String(error) });
  }
});

// GET /a2a/council/term/current - current active term info
router.get('/term/current', (_req: Request, res: Response) => {
  try {
    const term = council.getCurrentTerm();
    if (!term) {
      res.status(404).json({ error: 'not_found', message: 'No active term found' });
      return;
    }
    res.json(term);
  } catch (error) {
    console.error('Get current term error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /a2a/council/term/history - term history
router.get('/term/history', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const terms = council.getTermHistory(limit);
    res.json({ terms });
  } catch (error) {
    console.error('Get term history error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /a2a/council/:id - council session details
router.get('/:id', (req: Request, res: Response) => {
  try {
    const session = council.getSession(req.params.id);
    if (!session) {
      // Fallback: try to find as proposal
      const proposal = council.getProposal(req.params.id);
      if (proposal) {
        res.json(proposal);
        return;
      }
      res.status(404).json({ error: 'not_found', message: 'Council session or proposal not found' });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error('Get council session error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

// GET /a2a/council/history - list past council sessions
router.get('/history', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const sessions = council.getCouncilHistory(limit);
    res.json({ sessions });
  } catch (error) {
    console.error('Get council history error:', error);
    res.status(500).json({ error: 'query_failed', message: String(error) });
  }
});

export default router;
