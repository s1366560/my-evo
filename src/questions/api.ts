/**
 * Questions API Router
 * Section: Question Pipeline endpoints
 */

import { Router, Request, Response } from 'express';
import {
  parseAndCreateQuestion,
  getQuestion,
  getQuestionsByAuthor,
  listQuestions,
  updateQuestion,
  addAnswer,
  getAnswersForQuestion,
} from './engine';
import { ParseQuestionBody, Question } from './types';

const router = Router();

// Auth helper
function getNodeId(req: Request): string | null {
  return (req as Request & { nodeId?: string }).nodeId || null;
}

// POST /questions/parse — Parse user question, safety scan, auto-approve
router.post('/parse', (req: Request, res: Response) => {
  const nodeId = getNodeId(req);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    return;
  }

  const body = req.body as ParseQuestionBody;
  if (!body.question || typeof body.question !== 'string') {
    res.status(400).json({
      error: 'bad_request',
      message: 'Missing required field: question (string)',
      correction: { question: 'string (raw question text)' },
    });
    return;
  }

  if (body.question.length < 10) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Question too short (minimum 10 characters)',
    });
    return;
  }

  if (body.question.length > 50000) {
    res.status(400).json({
      error: 'bad_request',
      message: 'Question too long (maximum 50000 characters)',
    });
    return;
  }

  const { question, safety } = parseAndCreateQuestion(body, nodeId);

  res.status(201).json({
    question_id: question.question_id,
    title: question.title,
    state: question.state,
    safety,
    tags: question.tags,
    created_at: question.created_at,
  });
});

// GET /questions/my — List user's own questions (paginated)
router.get('/my', (req: Request, res: Response) => {
  const nodeId = getNodeId(req);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    return;
  }

  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const page_size = Math.min(100, Math.max(1, parseInt(String(req.query.page_size || '20'), 10)));

  const result = getQuestionsByAuthor(nodeId, page, page_size);

  res.json({
    items: result.items.map(q => ({
      question_id: q.question_id,
      title: q.title,
      tags: q.tags,
      state: q.state,
      bounty: q.bounty,
      views: q.views,
      answer_count: q.answer_count,
      created_at: q.created_at,
      updated_at: q.updated_at,
    })),
    pagination: {
      total: result.total,
      page: result.page,
      page_size: result.page_size,
      total_pages: result.total_pages,
    },
  });
});

// GET /questions — List all questions (public, paginated)
router.get('/', (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const page_size = Math.min(100, Math.max(1, parseInt(String(req.query.page_size || '20'), 10)));
  const state = req.query.state as any;
  const tag = req.query.tag as string | undefined;

  const result = listQuestions(page, page_size, { state, tag });

  res.json({
    items: result.items.map(q => ({
      question_id: q.question_id,
      title: q.title,
      tags: q.tags,
      state: q.state,
      bounty: q.bounty,
      views: q.views,
      answer_count: q.answer_count,
      created_at: q.created_at,
      updated_at: q.updated_at,
    })),
    pagination: {
      total: result.total,
      page: result.page,
      page_size: result.page_size,
      total_pages: result.total_pages,
    },
  });
});

// GET /questions/:id — Get question detail (public)
router.get('/:id', (req: Request, res: Response) => {
  const questionId = req.params.id;

  const q = getQuestion(questionId);
  if (!q) {
    res.status(404).json({ error: 'not_found', message: `Question ${questionId} not found` });
    return;
  }

  const answers = getAnswersForQuestion(questionId);

  res.json({
    question: {
      question_id: q.question_id,
      title: q.title,
      body: q.body,
      tags: q.tags,
      author: q.author,
      state: q.state,
      bounty: q.bounty,
      safety_score: q.safety_score,
      safety_flags: q.safety_flags,
      views: q.views,
      answer_count: q.answer_count,
      created_at: q.created_at,
      updated_at: q.updated_at,
    },
    answers: answers.map(a => ({
      answer_id: a.answer_id,
      body: a.body,
      author: a.author,
      accepted: a.accepted,
      upvotes: a.upvotes,
      downvotes: a.downvotes,
      created_at: a.created_at,
    })),
  });
});

// PATCH /questions/:id — Owner updates question title/body
router.patch('/:id', (req: Request, res: Response) => {
  const nodeId = getNodeId(req);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    return;
  }

  const questionId = req.params.id;
  const { title, body } = req.body as { title?: string; body?: string };

  if (!title && !body) {
    res.status(400).json({
      error: 'bad_request',
      message: 'At least one of title or body must be provided',
    });
    return;
  }

  if (title !== undefined && (typeof title !== 'string' || title.length < 5 || title.length > 300)) {
    res.status(400).json({
      error: 'bad_request',
      message: 'title must be a string between 5 and 300 characters',
    });
    return;
  }

  if (body !== undefined && (typeof body !== 'string' || body.length < 10 || body.length > 50000)) {
    res.status(400).json({
      error: 'bad_request',
      message: 'body must be a string between 10 and 50000 characters',
    });
    return;
  }

  const q = updateQuestion(questionId, nodeId, { title, body });
  if (!q) {
    res.status(404).json({ error: 'not_found', message: `Question ${questionId} not found or cannot be updated` });
    return;
  }

  res.json({
    question_id: q.question_id,
    title: q.title,
    state: q.state,
    updated_at: q.updated_at,
  });
});

// POST /questions/:id/answers — Add an answer to a question
router.post('/:id/answers', (req: Request, res: Response) => {
  const nodeId = getNodeId(req);
  if (!nodeId) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    return;
  }

  const questionId = req.params.id;
  const { body } = req.body as { body: string };

  if (!body || typeof body !== 'string' || body.length < 10 || body.length > 50000) {
    res.status(400).json({
      error: 'bad_request',
      message: 'body must be a string between 10 and 50000 characters',
    });
    return;
  }

  const answer = addAnswer(questionId, nodeId, body);
  if (!answer) {
    res.status(404).json({ error: 'not_found', message: `Question ${questionId} not found` });
    return;
  }

  res.status(201).json({
    answer_id: answer.answer_id,
    question_id: answer.question_id,
    created_at: answer.created_at,
  });
});

export default router;
