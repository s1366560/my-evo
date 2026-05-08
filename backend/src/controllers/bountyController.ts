import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../db/prisma.js';
import { BountyCreateInput, BountyClaimInput, BountyDeliverableInput } from '../models/schemas.js';

function generateBountyId(): string {
  const hash = crypto.createHash('sha256')
    .update(Date.now().toString() + Math.random().toString())
    .digest('hex')
    .substring(0, 12);
  return `bounty_${hash}`;
}

export class BountyController {
  // POST /bounty/create - Create a new bounty
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required to create bounty',
        });
        return;
      }
      
      const { title, description, requirements, reward, expires_in_days } = req.body as BountyCreateInput;
      
      // Check user has enough credits
      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
      });
      
      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found',
        });
        return;
      }
      
      // Generate bounty ID
      const bountyId = generateBountyId();
      
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      
      // Create bounty
      const bounty = await prisma.bounty.create({
        data: {
          bountyId,
          title,
          description,
          requirements,
          reward,
          expiresAt,
          userId: req.user.userId,
        },
      });
      
      res.status(201).json({
        bounty_id: bounty.bountyId,
        title: bounty.title,
        reward: bounty.reward,
        status: 'open',
        expires_at: bounty.expiresAt,
        message: 'Bounty created successfully',
      });
    } catch (error) {
      console.error('Bounty create error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create bounty',
      });
    }
  }
  
  // GET /bounty/list - List bounties
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      
      const where = status ? { status: status as string } : {};
      
      const bounties = await prisma.bounty.findMany({
        where,
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              username: true,
            },
          },
          _count: {
            select: {
              claims: true,
            },
          },
        },
      });
      
      const total = await prisma.bounty.count({ where });
      
      res.json({
        bounties,
        total,
        limit: Number(limit),
        offset: Number(offset),
      });
    } catch (error) {
      console.error('Bounty list error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to list bounties',
      });
    }
  }
  
  // GET /bounty/:bountyId - Get bounty details
  async getBounty(req: Request, res: Response): Promise<void> {
    try {
      const { bountyId } = req.params;
      
      const bounty = await prisma.bounty.findUnique({
        where: { bountyId },
        include: {
          user: {
            select: {
              username: true,
            },
          },
          claims: {
            where: { status: 'ACCEPTED' },
            select: {
              id: true,
              user: {
                select: {
                  username: true,
                },
              },
              deliverable: true,
              submittedAt: true,
            },
          },
        },
      });
      
      if (!bounty) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Bounty not found',
        });
        return;
      }
      
      res.json({ bounty });
    } catch (error) {
      console.error('Get bounty error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get bounty',
      });
    }
  }
  
  // POST /bounty/:bountyId/claim - Claim a bounty
  async claim(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required to claim bounty',
        });
        return;
      }
      
      const { bountyId } = req.params;
      
      const bounty = await prisma.bounty.findUnique({
        where: { bountyId },
      });
      
      if (!bounty) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Bounty not found',
        });
        return;
      }
      
      if (bounty.status !== 'OPEN') {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Bounty is not open for claims',
        });
        return;
      }
      
      if (new Date() > bounty.expiresAt!) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'Bounty has expired',
        });
        return;
      }
      
      // Check if user already has a claim
      const existingClaim = await prisma.bountyClaim.findFirst({
        where: {
          bountyId: bounty.id,
          userId: req.user.userId,
        },
      });
      
      if (existingClaim) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You already have a claim on this bounty',
        });
        return;
      }
      
      // Create claim
      const claim = await prisma.bountyClaim.create({
        data: {
          bountyId: bounty.id,
          userId: req.user.userId,
        },
      });
      
      // Update bounty status
      await prisma.bounty.update({
        where: { id: bounty.id },
        data: { status: 'IN_PROGRESS' },
      });
      
      res.status(201).json({
        claim_id: claim.id,
        bounty_id: bountyId,
        status: 'pending',
        message: 'Bounty claimed successfully',
      });
    } catch (error) {
      console.error('Bounty claim error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to claim bounty',
      });
    }
  }
  
  // POST /bounty/:bountyId/submit - Submit deliverable
  async submit(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required',
        });
        return;
      }
      
      const { bountyId } = req.params;
      const { deliverable, feedback } = req.body as BountyDeliverableInput;
      
      const bounty = await prisma.bounty.findUnique({
        where: { bountyId },
      });
      
      if (!bounty) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Bounty not found',
        });
        return;
      }
      
      // Find user's claim
      const claim = await prisma.bountyClaim.findFirst({
        where: {
          bountyId: bounty.id,
          userId: req.user.userId,
        },
      });
      
      if (!claim) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'You have not claimed this bounty',
        });
        return;
      }
      
      // Update claim with deliverable
      await prisma.bountyClaim.update({
        where: { id: claim.id },
        data: {
          deliverable,
          feedback,
          status: 'SUBMITTED',
          submittedAt: new Date(),
        },
      });
      
      res.json({
        claim_id: claim.id,
        status: 'submitted',
        message: 'Deliverable submitted successfully',
      });
    } catch (error) {
      console.error('Submit deliverable error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to submit deliverable',
      });
    }
  }
  
  // POST /bounty/:bountyId/review - Accept or reject submission (bounty owner)
  async review(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required',
        });
        return;
      }
      
      const { bountyId } = req.params;
      const { claim_id, accepted, feedback } = req.body;
      
      const bounty = await prisma.bounty.findUnique({
        where: { bountyId },
      });
      
      if (!bounty) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Bounty not found',
        });
        return;
      }
      
      if (bounty.userId !== req.user.userId) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'Only bounty owner can review submissions',
        });
        return;
      }
      
      const claim = await prisma.bountyClaim.findUnique({
        where: { id: claim_id },
      });
      
      if (!claim || claim.bountyId !== bounty.id) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Claim not found',
        });
        return;
      }
      
      // Update claim status
      await prisma.bountyClaim.update({
        where: { id: claim.id },
        data: {
          status: accepted ? 'ACCEPTED' : 'REJECTED',
          feedback,
        },
      });
      
      if (accepted) {
        // Complete the bounty
        await prisma.bounty.update({
          where: { id: bounty.id },
          data: {
            status: 'COMPLETED',
            completedAt: new Date(),
          },
        });
        
        // Award credits to claimer (simplified - would integrate with credits system)
        res.json({
          message: 'Submission accepted. Bounty completed.',
          status: 'completed',
        });
      } else {
        // Reopen bounty for others
        await prisma.bounty.update({
          where: { id: bounty.id },
          data: { status: 'OPEN' },
        });
        
        res.json({
          message: 'Submission rejected. Bounty reopened.',
          status: 'open',
        });
      }
    } catch (error) {
      console.error('Review claim error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to review claim',
      });
    }
  }
  
  // GET /bounty/my - Get user's bounties
  async myBounties(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Login required',
        });
        return;
      }
      
      const created = await prisma.bounty.findMany({
        where: { userId: req.user.userId },
        orderBy: { createdAt: 'desc' },
      });
      
      const claimed = await prisma.bountyClaim.findMany({
        where: { userId: req.user.userId },
        include: {
          bounty: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      
      res.json({
        created,
        claimed,
      });
    } catch (error) {
      console.error('My bounties error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get bounties',
      });
    }
  }
}

export const bountyController = new BountyController();
