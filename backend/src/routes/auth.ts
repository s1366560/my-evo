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

export default router;
