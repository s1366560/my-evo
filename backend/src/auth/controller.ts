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
}

export const authController = new AuthController();
