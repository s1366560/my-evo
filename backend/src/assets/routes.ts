// Express routes for the assets marketplace.
// Mounted at /api/v1/assets and /api/v1/marketplace (per task spec).
import { Router, Response, NextFunction } from 'express';
import { assetController } from './controller.js';
import {
  assetAuth, assetAuthRequired, requireHumanIdentity,
  type AssetAuthRequest,
} from '../middleware/assetAuth.js';

const router = Router();

// Public read endpoints (auth resolved but not required)
router.get('/', assetAuth, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.list(req, res, next));
router.get('/:assetId', assetAuth, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.detail(req, res, next));
router.get('/:assetId/versions', assetAuth, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.versions(req, res, next));

// Authoring — session or API key required
router.post('/', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.create(req, res, next));
router.patch('/:assetId', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.update(req, res, next));
router.post('/:assetId/publish', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.publish(req, res, next));
router.post('/:assetId/recycle', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.recycle(req, res, next));

// Human-only actions
router.post('/:assetId/reviews', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.review(req, res, next));
router.post('/:assetId/purchase', assetAuth, assetAuthRequired, requireHumanIdentity, (req: AssetAuthRequest, res: Response, next: NextFunction) => assetController.purchase(req, res, next));

export { router as assetRouter };
