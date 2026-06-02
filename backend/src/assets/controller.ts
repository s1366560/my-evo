// HTTP controller for the assets marketplace.
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { assetService } from './service.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  CreateAssetSchema, UpdateAssetSchema, PublishAssetSchema,
  CreateReviewSchema, PurchaseAssetSchema, ListAssetsQuerySchema,
} from './schemas.js';
import type { AssetAuthRequest } from '../middleware/assetAuth.js';
import { requireUserId } from '../middleware/assetAuth.js';

function parseOrThrow<T>(schema: { parse: (v: unknown) => T }, raw: unknown): T {
  try {
    return schema.parse(raw);
  } catch (e) {
    if (e instanceof ZodError) {
      const message = e.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`).join('; ');
      throw new HttpError(400, `Invalid request: ${message}`);
    }
    throw e;
  }
}

export class AssetController {
  // GET /api/v1/assets?type=...&status=...&q=...&page=1&limit=20
  async list(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const q = parseOrThrow(ListAssetsQuerySchema, req.query);
      const result = await assetService.listAssets({
        page: q.page, limit: q.limit,
        type: q.type, status: q.status,
        authorId: q.authorId, nodeId: q.nodeId, q: q.q,
      });
      res.json({ success: true, ...result });
    } catch (e) { next(e); }
  }

  // GET /api/v1/assets/:assetId
  async detail(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = await assetService.getAsset(req.params.assetId);
      res.json({ success: true, data: dto });
    } catch (e) { next(e); }
  }

  // POST /api/v1/assets
  async create(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = parseOrThrow(CreateAssetSchema, req.body);
      const dto = await assetService.createAsset(userId, data);
      res.status(201).json({ success: true, data: dto });
    } catch (e) { next(e); }
  }

  // PATCH /api/v1/assets/:assetId
  async update(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = parseOrThrow(UpdateAssetSchema, req.body);
      const dto = await assetService.updateAsset(userId, req.params.assetId, data);
      res.json({ success: true, data: dto });
    } catch (e) { next(e); }
  }

  // POST /api/v1/assets/:assetId/publish
  async publish(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = parseOrThrow(PublishAssetSchema, req.body ?? {});
      const v = await assetService.publishAsset(userId, req.params.assetId, data);
      res.status(201).json({ success: true, data: v });
    } catch (e) { next(e); }
  }

  // GET /api/v1/assets/:assetId/versions
  async versions(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const versions = await assetService.getVersionHistory(req.params.assetId);
      res.json({ success: true, data: versions });
    } catch (e) { next(e); }
  }

  // POST /api/v1/assets/:assetId/reviews
  async review(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = parseOrThrow(CreateReviewSchema, req.body);
      const review = await assetService.createReview(userId, req.params.assetId, data);
      res.status(201).json({ success: true, data: review });
    } catch (e) { next(e); }
  }

  // POST /api/v1/assets/:assetId/purchase
  async purchase(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const data = parseOrThrow(PurchaseAssetSchema, req.body ?? {});
      const purchase = await assetService.purchaseAsset(userId, req.params.assetId, data);
      res.status(201).json({ success: true, data: purchase });
    } catch (e) { next(e); }
  }

  // POST /api/v1/assets/:assetId/recycle
  async recycle(req: AssetAuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = requireUserId(req);
      const dto = await assetService.recycleAsset(userId, req.params.assetId);
      res.json({ success: true, data: dto });
    } catch (e) { next(e); }
  }
}

export const assetController = new AssetController();
