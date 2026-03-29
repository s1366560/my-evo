/**
 * GEPX API Endpoints
 * Chapter 31: Portable Asset Archive Export/Import
 *
 * Endpoints:
 * - POST  /gepx/export          Export assets as .gepx bundle
 * - POST  /gepx/export/single    Export a single asset as .gepx
 * - POST  /gepx/import           Import a .gepx bundle
 * - GET   /gepx/validate         Validate a .gepx file (header + structure)
 * - GET   /gepx/bundle/:id      Preview bundle contents without importing
 */

import { Router, Request, Response } from 'express';
import { validateNodeSecret } from '../a2a/node';
import { encodeGepxBundle, encodeSingleAsset, encodeLineageBundle } from './encode';
import { decodeGepxBuffer, validateGepxPayload, extractAssets } from './decode';
import { getAsset, listAssets, saveAsset, getAssetsByOwner, getAssetLineage } from '../assets/store';
import { getAssetDetails } from '../assets/fetch';
import type { GepxLineageRecord } from './types';

const router = Router();

// ─── Auth Middleware ───────────────────────────────────────────────────────────

function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Missing Authorization header' });
  }
  const nodeId = validateNodeSecret(auth.slice(7));
  if (!nodeId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Invalid node_secret' });
  }
  req.nodeId = nodeId;
  next();
}

// ─── POST /gepx/export ─────────────────────────────────────────────────────────

/**
 * Export a set of assets as a .gepx bundle.
 * Body: { asset_ids?: string[], owner_id?: string, bundle_name?: string,
 *         description?: string, tags?: string[], lineage?: boolean }
 */
router.post('/export', requireAuth, (req: any, res: any) => {
  const { asset_ids, owner_id, bundle_name, description, tags, lineage } = req.body;

  // Gather records
  let records;
  if (asset_ids && Array.isArray(asset_ids) && asset_ids.length > 0) {
    records = asset_ids.map((id: string) => getAsset(id)).filter(Boolean);
  } else if (owner_id) {
    records = getAssetsByOwner(owner_id);
  } else {
    // Export own assets
    records = getAssetsByOwner(req.nodeId);
  }

  if (records.length === 0) {
    return res.status(404).json({ error: 'not_found', message: 'No assets found to export' });
  }

  // Build lineage if requested
  let lineageRecords: GepxLineageRecord[] | undefined;
  if (lineage) {
    lineageRecords = [];
    for (const record of records) {
      const lineage = getAssetLineage(record.asset.asset_id);
      for (const edge of lineage) {
        if (!lineageRecords.some(r => r.parent_id === edge.parent_id && r.child_id === edge.child_id)) {
          lineageRecords.push(edge);
        }
      }
    }
  }

  const result = encodeGepxBundle({
    records,
    bundleName: bundle_name,
    description,
    tags,
    exporterNodeId: req.nodeId,
    lineage: lineageRecords,
    compress: true,
  });

  // Return as base64 for easy download
  res.json({
    bundle_type: result.payload.bundle_type,
    asset_count: result.payload.assets.length,
    checksum: result.checksum,
    exported_at: result.payload.exported_at,
    data: result.data.toString('base64'),
    download_url: `data:application/octet-stream;base64,${result.data.toString('base64')}`,
  });
});

// ─── POST /gepx/export/single ──────────────────────────────────────────────────

/**
 * Export a single asset as a self-contained .gepx file.
 * Body: { asset_id: string }
 */
router.post('/export/single', requireAuth, (req: any, res: any) => {
  const { asset_id } = req.body;

  if (!asset_id) {
    return res.status(400).json({ error: 'invalid_request', message: 'asset_id is required' });
  }

  const record = getAsset(asset_id);
  if (!record) {
    return res.status(404).json({ error: 'not_found', message: `Asset ${asset_id} not found` });
  }

  const asset = record.asset;
  const result = encodeSingleAsset({
    assetId: asset_id,
    asset,
    record,
    exporterNodeId: req.nodeId,
    compress: true,
  });

  res.json({
    bundle_type: result.payload.bundle_type,
    asset_id: result.payload.assets[0]?.asset_id,
    checksum: result.checksum,
    exported_at: result.payload.exported_at,
    data: result.data.toString('base64'),
    download_url: `data:application/octet-stream;base64,${result.data.toString('base64')}`,
  });
});

// ─── POST /gepx/import ─────────────────────────────────────────────────────────

/**
 * Import a .gepx bundle into the local store.
 * Body: { data: base64-encoded .gepx content, asset_ids?: string[] (optional filter) }
 */
router.post('/import', requireAuth, async (req: any, res: any) => {
  const { data: base64Data, asset_ids } = req.body;

  if (!base64Data) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing field: data (base64 .gepx content)' });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid base64 data' });
  }

  let decodeResult;
  try {
    decodeResult = await decodeGepxBuffer(buffer);
  } catch (err: any) {
    return res.status(400).json({ error: 'invalid_gepx', message: err.message });
  }

  const { payload, checksum, verified } = decodeResult;
  const validation = validateGepxPayload(payload);

  if (!validation.valid) {
    return res.status(400).json({
      error: 'invalid_bundle',
      message: 'GEPX bundle validation failed',
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }

  // Extract and optionally filter assets
  const { genes, capsules, evolutionEvents, records } = extractAssets(payload);
  const allRecords = Array.from(records.values());

  const imported: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  for (const [assetId, record] of records) {
    // Filter by asset_ids if provided
    if (asset_ids && Array.isArray(asset_ids) && !asset_ids.includes(assetId)) {
      skipped.push(assetId);
      continue;
    }

    try {
      // Check if asset already exists
      const existing = getAsset(assetId);
      if (existing) {
        skipped.push(assetId);
        errors.push(`Asset ${assetId} already exists — skipping (use force flag to overwrite)`);
        continue;
      }

      // Save to store (re-publish as the importing node)
      const saved = saveAsset({
        ...record,
        asset: record.asset as any,
        status: 'active',
        published_at: record.asset.published_at,
      } as any);
      if (saved) {
        imported.push(assetId);
      } else {
        errors.push(`Failed to save asset ${assetId}`);
      }
    } catch (err: any) {
      errors.push(`Error importing ${assetId}: ${err.message}`);
    }
  }

  res.json({
    status: 'import_complete',
    bundle_type: payload.bundle_type,
    checksum,
    checksum_verified: verified,
    validation_warnings: validation.warnings,
    imported_count: imported.length,
    skipped_count: skipped.length,
    error_count: errors.length,
    imported_assets: imported,
    skipped_assets: skipped,
    errors,
  });
});

// ─── GET /gepx/validate ────────────────────────────────────────────────────────

/**
 * Validate a .gepx file header and structure without importing.
 * Query: ?data=<base64>
 */
router.get('/validate', async (req: any, res: any) => {
  const { data: base64Data } = req.query;

  if (!base64Data) {
    return res.status(400).json({ error: 'invalid_request', message: 'Missing query param: data (base64 .gepx)' });
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data as string, 'base64');
  } catch {
    return res.status(400).json({ error: 'invalid_request', message: 'Invalid base64 data' });
  }

  try {
    const result = await decodeGepxBuffer(buffer);
    const validation = validateGepxPayload(result.payload);

    res.json({
      valid: validation.valid,
      checksum_verified: result.verified,
      payload: {
        version: result.payload.version,
        bundle_type: result.payload.bundle_type,
        exported_at: result.payload.exported_at,
        asset_count: result.payload.assets.length,
        metadata: result.payload.metadata,
      },
      errors: validation.errors,
      warnings: validation.warnings,
    });
  } catch (err: any) {
    res.status(400).json({ valid: false, error: err.message });
  }
});

// ─── GET /gepx/bundle/:id ───────────────────────────────────────────────────────

/**
 * Preview a .gepx bundle's contents (metadata + asset list) without importing.
 */
router.get('/bundle/:id', async (req: any, res: any) => {
  const { id } = req.params;

  // Get asset and its lineage to build a preview
  const record = getAsset(id);
  if (!record) {
    return res.status(404).json({ error: 'not_found', message: `Asset ${id} not found` });
  }

  // Build a minimal preview export
  const result = encodeSingleAsset({
    assetId: id,
    asset: record.asset as any,
    record,
    compress: false, // uncompressed for readability
  });

  const { payload } = result;

  res.json({
    asset_id: id,
    type: record.asset.type,
    bundle_type: payload.bundle_type,
    exported_at: payload.exported_at,
    assets: payload.assets.map(a => ({
      asset_id: a.asset_id,
      type: a.type,
      owner_id: a.owner_id,
      status: a.status,
      gdi: a.gdi,
    })),
    lineage: payload.lineage ?? [],
    metadata: payload.metadata,
  });
});

export default router;
