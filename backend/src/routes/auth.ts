import { Router } from 'express';
import { authController } from '../auth/controller.js';
import { authenticate, AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.post('/register', authController.register.bind(authController));
router.post('/login', authController.login.bind(authController));
router.post('/refresh', authController.refreshToken.bind(authController));

router.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ success: true, data: { user: req.user } });
});

export { router as authRouter };
