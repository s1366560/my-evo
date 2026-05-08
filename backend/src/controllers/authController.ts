import { Request, Response } from 'express';
import prisma from '../db/prisma.js';
import { hashPassword, verifyPassword, signToken } from '../auth/jwt.js';
import { RegisterInput, LoginInput } from '../models/schemas.js';

export class AuthController {
  // POST /auth/register
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, username, password } = req.body as RegisterInput;

      // Check if user already exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }],
        },
      });

      if (existingUser) {
        res.status(409).json({
          error: 'Conflict',
          message: existingUser.email === email
            ? 'Email already registered'
            : 'Username already taken',
        });
        return;
      }

      // Hash password and create user
      const passwordHash = await hashPassword(password);

      const user = await prisma.user.create({
        data: {
          email,
          username,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          createdAt: true,
        },
      });

      // Generate JWT token
      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      res.status(201).json({
        message: 'Registration successful',
        user,
        token,
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to register user',
      });
    }
  }

  // POST /auth/login
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body as LoginInput;

      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true,
          email: true,
          username: true,
          passwordHash: true,
          role: true,
          isActive: true,
        },
      });

      if (!user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }

      if (!user.isActive) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Account is deactivated',
        });
        return;
      }

      // Verify password
      const isValidPassword = await verifyPassword(password, user.passwordHash);

      if (!isValidPassword) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
        return;
      }

      // Generate JWT token
      const token = signToken({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Return user without password
      const { passwordHash: _, ...userWithoutPassword } = user;

      res.json({
        message: 'Login successful',
        user: userWithoutPassword,
        token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to login',
      });
    }
  }

  // PUT /auth/me - Update current user profile
  async updateMe(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
        return;
      }

      const { username, email } = req.body;

      // Check if username or email is already taken by another user
      if (username || email) {
        const existingUser = await prisma.user.findFirst({
          where: {
            AND: [
              { NOT: { id: req.user.userId } },
              ...(username ? [{ username }] : []),
              ...(email ? [{ email }] : []),
            ],
          },
        });

        if (existingUser) {
          res.status(409).json({
            error: 'Conflict',
            message: existingUser.username === username
              ? 'Username already taken'
              : 'Email already registered',
          });
          return;
        }
      }

      const updatedUser = await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          ...(username && { username }),
          ...(email && { email }),
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({
        message: 'Profile updated successfully',
        user: updatedUser,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update profile',
      });
    }
  }

  // GET /auth/me
  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Not authenticated',
        });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          apiKey: true,
          apiKeyCreatedAt: true,
          nodes: {
            select: {
              nodeId: true,
              name: true,
              status: true,
              reputation: true,
              level: true,
            },
          },
          _count: {
            select: {
              assets: true,
              bounties: true,
            },
          },
        },
      });

      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }

      // Calculate account age in days
      const accountAgeDays = user.createdAt
        ? Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      // Determine creator level based on published assets
      const creatorLevel = Math.min(3, Math.floor((user._count?.assets || 0) / 5));

      res.json({
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          isActive: user.isActive,
          createdAt: user.createdAt,
          accountAgeDays,
          creatorLevel,
          totalMaps: 0, // Maps not yet implemented
          recentActivity: user.nodes && user.nodes.length > 0 ? user.nodes[0].reputation : 0,
          accountPlan: 'free',
          totalEarnings: 0, // Earnings tracking not yet implemented
          hasApiKey: !!user.apiKey,
          apiKeyCreatedAt: user.apiKeyCreatedAt,
        },
      });
    } catch (error) {
      console.error('Get user error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get user',
      });
    }
  }

  // GET /auth/api-key — Get masked API key info
  async getApiKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { apiKey: true, apiKeyCreatedAt: true },
      });

      if (!user) {
        res.status(404).json({ error: 'Not Found', message: 'User not found' });
        return;
      }

      const maskedKey = user.apiKey
        ? `evo_${user.apiKey.substring(0, 8)}...${user.apiKey.substring(user.apiKey.length - 4)}`
        : null;

      res.json({
        hasKey: !!user.apiKey,
        maskedKey,
        createdAt: user.apiKeyCreatedAt,
      });
    } catch (error) {
      console.error('Get API key error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to get API key' });
    }
  }

  // POST /auth/api-key/regenerate — Generate a new API key
  async regenerateApiKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
        return;
      }

      // Generate a new random API key
      const crypto = await import('crypto');
      const newKey = crypto.randomBytes(32).toString('hex');

      await prisma.user.update({
        where: { id: req.user.userId },
        data: {
          apiKey: newKey,
          apiKeyCreatedAt: new Date(),
        },
      });

      // Return the full key (only time it's shown in full)
      res.json({
        message: 'API key regenerated successfully',
        apiKey: `evo_${newKey}`,
        createdAt: new Date().toISOString(),
        warning: 'This is the only time the full key will be shown. Store it securely.',
      });
    } catch (error) {
      console.error('Regenerate API key error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to regenerate API key' });
    }
  }

  // DELETE /auth/api-key — Delete the current API key
  async deleteApiKey(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized', message: 'Not authenticated' });
        return;
      }

      await prisma.user.update({
        where: { id: req.user.userId },
        data: { apiKey: null, apiKeyCreatedAt: null },
      });

      res.json({ message: 'API key deleted successfully' });
    } catch (error) {
      console.error('Delete API key error:', error);
      res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete API key' });
    }
  }
}

export const authController = new AuthController();
