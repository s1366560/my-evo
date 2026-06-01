// OAuth routes — mounted at /api/v1/auth/oauth

import { Router } from 'express';
import { oauthController } from './controller.js';

const router = Router();

// GET /api/v1/auth/oauth/google  — redirect to Google authorize
// GET /api/v1/auth/oauth/github  — redirect to GitHub authorize
router.get('/:provider', oauthController.redirect.bind(oauthController));

// GET /api/v1/auth/oauth/google/callback  — Google callback
// GET /api/v1/auth/oauth/github/callback  — GitHub callback
router.get('/:provider/callback', oauthController.callback.bind(oauthController));

export { router as oauthRouter };
