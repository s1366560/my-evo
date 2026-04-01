/**
 * Reading Engine API
 * 
 * HTTP routes for the Reading Engine (evomap.ai Ch15):
 * - POST /reading/analyze       (URL or text input → questions)
 * - GET  /reading/sessions      (list sessions)
 * - GET  /reading/sessions/:id  (get session)
 * - POST /reading/sessions      (create session)
 * - POST /reading/questions/:id/bounty (attach bounty to question)
 * - GET  /reading/trending      (trending readings)
 * - GET  /reading/stats         (reading stats)
 */

import { Request, Response } from 'express';
import {
  processArticle,
  createSession,
  getSession,
  addToSession,
  getTrendingReadings,
  getReadingStats,
} from './service';

export function registerReadingRoutes(app: import('express').Express): void {
  // ==================== Analyze ====================

  // POST /reading/analyze - Analyze URL or text content and generate questions
  app.post('/reading/analyze', async (req: Request, res: Response) => {
    try {
      const { url, content, title, sessionId, generateQuestions } = req.body;

      if (!url && !content) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Either url or content must be provided',
        });
        return;
      }

      if (content && content.length > 50000) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Content exceeds 50000 character limit',
        });
        return;
      }

      const result = processArticle({
        url,
        content,
        title,
        generateQuestions: generateQuestions !== false,
      });

      // If sessionId provided, add to session
      if (sessionId) {
        addToSession(sessionId, result);
      }

      res.json({
        id: result.id,
        url: result.url,
        title: result.title,
        summary: result.summary,
        questions: result.questions.map(q => ({
          id: q.id,
          question: q.question,
          type: q.type,
          context: q.context,
          bountyCredits: q.bountyCredits,
          createdAt: q.createdAt,
        })),
        keyInformation: result.keyInformation,
        entities: result.entities,
        processedAt: result.processedAt,
      });
    } catch (err) {
      console.error('Reading analyze error:', err);
      res.status(500).json({ error: 'internal_error', message: 'Analysis failed' });
    }
  });

  // ==================== Sessions ====================

  // POST /reading/sessions - Create a reading session
  app.post('/reading/sessions', (req: Request, res: Response) => {
    const { userId } = req.body;
    const session = createSession(userId);
    res.status(201).json(session);
  });

  // GET /reading/sessions/:id - Get session details
  app.get('/reading/sessions/:id', (req: Request, res: Response) => {
    const session = getSession(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'not_found', message: 'Session not found' });
      return;
    }
    res.json(session);
  });

  // ==================== Bounty ====================

  // POST /reading/questions/:id/bounty - Attach bounty to a discovered question
  app.post('/reading/questions/:id/bounty', (req: Request, res: Response) => {
    const { bountyCredits, sessionId } = req.body;
    const questionId = req.params.id;

    if (!bountyCredits || bountyCredits < 1) {
      res.status(400).json({
        error: 'bad_request',
        message: 'bountyCredits must be at least 1',
      });
      return;
    }

    // Find the question in sessions
    let found = false;
    if (sessionId) {
      const session = getSession(sessionId);
      if (session) {
        for (const reading of session.readings) {
          const q = reading.questions.find(q => q.id === questionId);
          if (q) {
            q.bountyCredits = bountyCredits;
            found = true;
            res.json({
              questionId: q.id,
              bountyCredits: q.bountyCredits,
              status: 'bounty_attached',
              eligible_for: ['agent_matching', 'swarm_decomposition', 'bounty_lifecycle'],
            });
            return;
          }
        }
      }
    }

    if (!found) {
      res.status(404).json({
        error: 'not_found',
        message: 'Question not found in any session',
      });
    }
  });

  // ==================== Trending & Stats ====================

  // GET /reading/trending - Get trending readings
  app.get('/reading/trending', (req: Request, res: Response) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const readings = getTrendingReadings(Math.min(limit, 50));
    res.json({ readings, count: readings.length });
  });

  // GET /reading/stats - Get reading engine statistics
  app.get('/reading/stats', (_req: Request, res: Response) => {
    const stats = getReadingStats();
    res.json(stats);
  });

  console.log('[Reading Engine] Routes registered: /reading/*');
}
