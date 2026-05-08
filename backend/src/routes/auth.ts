import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validation.js';
import { registerSchema, loginSchema } from '../models/schemas.js';

const router = Router();

// POST /auth/register
router.post('/register', validateBody(registerSchema), (req, res) => {
  authController.register(req, res);
});

// POST /auth/login
router.post('/login', validateBody(loginSchema), (req, res) => {
  authController.login(req, res);
});

// GET /auth/me
router.get('/me', authenticate, (req, res) => {
  authController.me(req, res);
});

// PUT /auth/me - Update current user profile
router.put('/me', authenticate, (req, res) => {
  authController.updateMe(req, res);
});

// GET /auth/api-key — Get masked API key info
router.get('/api-key', authenticate, (req, res) => {
  authController.getApiKey(req, res);
});

// POST /auth/api-key/regenerate — Generate a new API key
router.post('/api-key/regenerate', authenticate, (req, res) => {
  authController.regenerateApiKey(req, res);
});

// DELETE /auth/api-key — Delete the current API key
router.delete('/api-key', authenticate, (req, res) => {
  authController.deleteApiKey(req, res);
});

export default router;
