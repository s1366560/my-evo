import { Router } from 'express';
import { bountyController } from '../controllers/bountyController.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { bountyCreateSchema, bountyClaimSchema, bountyDeliverableSchema } from '../models/schemas.js';

const router = Router();

// POST /bounty/create - Create a new bounty
router.post('/create', authenticate, validateBody(bountyCreateSchema), (req, res) => {
  bountyController.create(req, res);
});

// GET /bounty/list - List bounties
router.get('/list', (req, res) => {
  bountyController.list(req, res);
});

// GET /bounty/:bountyId - Get bounty details
router.get('/:bountyId', (req, res) => {
  bountyController.getBounty(req, res);
});

// POST /bounty/:bountyId/claim - Claim a bounty
router.post('/:bountyId/claim', authenticate, (req, res) => {
  bountyController.claim(req, res);
});

// POST /bounty/:bountyId/submit - Submit deliverable
router.post('/:bountyId/submit', authenticate, validateBody(bountyDeliverableSchema), (req, res) => {
  bountyController.submit(req, res);
});

// POST /bounty/:bountyId/review - Review submission (bounty owner)
router.post('/:bountyId/review', authenticate, (req, res) => {
  bountyController.review(req, res);
});

// GET /bounty/my - Get user's bounties
router.get('/my/claims', authenticate, (req, res) => {
  bountyController.myBounties(req, res);
});

export default router;
