import { Request, Response, NextFunction } from 'express';
import { authService } from './service.js';
import { HttpError } from '../middleware/errorHandler.js';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, name } = req.body;
      if (!email || !password) {
        throw new HttpError(400, 'Email and password are required');
      }
      if (password.length < 8) {
        throw new HttpError(400, 'Password must be at least 8 characters');
      }
      const result = await authService.register({ email, password, name });
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        throw new HttpError(400, 'Email and password are required');
      }
      const result = await authService.login({ email, password });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        throw new HttpError(400, 'Refresh token is required');
      }
      const result = await authService.refreshToken(refreshToken);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;
      if (!email) {
        throw new HttpError(400, 'Email is required');
      }
      // Always respond 202 to avoid email enumeration. In dev/mock we surface
      // the token for testing; in production an email side-channel is used.
      const isProd = process.env.NODE_ENV === 'production';
      const result = await authService.forgotPassword(email);
      res.status(202).json({
        success: true,
        data: {
          message: 'If the email exists, a reset link has been sent.',
          // Only return the token outside production for testing/E2E
          ...(isProd || !result.resetToken ? {} : { resetToken: result.resetToken }),
          expiresAt: result.expiresAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { token, password } = req.body;
      if (!token || !password) {
        throw new HttpError(400, 'Token and password are required');
      }
      const result = await authService.resetPassword(token, password);
      res.json({
        success: true,
        data: {
          userId: result.userId,
          message: 'Password has been reset successfully.',
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
