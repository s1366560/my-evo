/**
 * Asset Publishing Logic
 * Phase 2: Asset System
 */

import * as crypto from 'crypto';
import {
  Asset,
  AssetBundle,
  Gene,
  Capsule,
  EvolutionEvent,
  Mutation,
  Recipe,
  Organism,
  PublishResult,
  GDIScore,
} from './types';
import {
  saveAsset,
  checkPublishRateLimit,
  recordPublish,
  getAsset,
} from './store';
import { calculateGDI, calculateCarbonCost, shouldPromote } from './gdi';
import { checkSimilarity } from './similarity';
import { buildBundleLineage } from './lineage';

// Schema version
const CURRENT_SCHEMA_VERSION = '1.5.0';

/**
 * Validate asset structure before publishing
 */
export function validateAsset(asset: Asset): string[] {
  const errors: string[] = [];

  if (!asset.type) {
    errors.push('Missing asset type');
    return errors;
  }

  if (!asset.asset_id) {
    errors.push('Missing asset_id (SHA-256 content hash required)');
  } else if (!asset.asset_id.startsWith('sha256:')) {
    errors.push('asset_id must start with "sha256:"');
  }

  if (!asset.id) {
    errors.push('Missing id field');
  }

  // Type-specific validation
  if (asset.type === 'Gene') {
    const gene = asset as Gene;
    if (!gene.signals_match || gene.signals_match.length === 0) {
      errors.push('Gene must have at least one signals_match entry');
    }
    if (!gene.strategy || gene.strategy.length === 0) {
      errors.push('Gene must have at least one strategy step');
    }
    if (!gene.constraints || Object.keys(gene.constraints).length === 0) {
      errors.push('Gene must define constraints');
    }
  }

  if (asset.type === 'Capsule') {
    const capsule = asset as Capsule;
    if (!capsule.trigger || capsule.trigger.length === 0) {
      errors.push('Capsule must have at least one trigger');
    }
    if (!capsule.gene) {
      errors.push('Capsule must reference a source gene');
    }
    if (capsule.confidence === undefined || capsule.confidence < 0 || capsule.confidence > 1) {
      errors.push('Capsule confidence must be between 0 and 1');
    }
    if (!capsule.blast_radius) {
      errors.push('Capsule must define blast_radius');
    }
    if (!capsule.outcome) {
      errors.push('Capsule must define outcome');
    }
  }

  return errors;
}

/**
 * Compute SHA-256 content hash for an asset
 */
export function computeAssetHash(asset: Asset): string {
  // Create a canonical representation
  const canonical = JSON.stringify({
    type: asset.type,
    id: asset.id,
    // Include type-specific fields that affect identity
    ...(asset.type === 'Gene' ? {
      category: (asset as Gene).category,
      signals_match: (asset as Gene).signals_match,
      strategy: (asset as Gene).strategy,
      constraints: (asset as Gene).constraints,
    } : {}),
    ...(asset.type === 'Capsule' ? {
      gene: (asset as Capsule).gene,
      trigger: (asset as Capsule).trigger,
      content: (asset as Capsule).content,
      summary: (asset as Capsule).summary,
    } : {}),
  });

  const hash = crypto.createHash('sha256').update(canonical).digest('hex');
  return `sha256:${hash}`;
}

/**
 * Ensure asset has asset_id and schema_version
 */
export function normalizeAsset(asset: Asset): Asset {
  const now = new Date().toISOString();

  // Compute or verify asset_id
  if (!asset.asset_id || !asset.asset_id.startsWith('sha256:')) {
    const normalized = { ...asset, asset_id: computeAssetHash(asset) } as Asset;
    asset = normalized;
  }

  // Set schema version on types that have it
  if (asset.type === 'Gene' || asset.type === 'Capsule' || asset.type === 'Recipe' || asset.type === 'Organism') {
    asset.schema_version = CURRENT_SCHEMA_VERSION;
  }

  // Set timestamps
  if (!asset.created_at) {
    asset.created_at = now;
  }

  return asset;
}

/**
 * Publish an asset bundle
 */
export function publishAsset(
  bundle: AssetBundle,
  ownerId: string,
  nodeSecret: string
): PublishResult {
  const now = Date.now();

  // Check rate limit
  const rateLimit = checkPublishRateLimit(ownerId);
  if (!rateLimit.allowed) {
    return {
      status: 'rejected',
      asset_ids: [],
      carbon_cost: 0,
      rejection_reasons: [
        `Rate limit exceeded. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.`,
      ],
    };
  }

  const { assets, evolution_event } = bundle;

  if (!assets || assets.length === 0) {
    return {
      status: 'rejected',
      asset_ids: [],
      carbon_cost: 0,
      rejection_reasons: ['No assets provided in bundle'],
    };
  }

  const rejectionReasons: string[] = [];
  const successfulAssets: string[] = [];
  const gdiScores: Record<string, GDIScore> = {};
  let totalCarbonCost = 0;

  // Process each asset
  for (const asset of assets) {
    // Normalize
    const normalized = normalizeAsset(asset);

    // Validate
    const errors = validateAsset(normalized);
    if (errors.length > 0) {
      rejectionReasons.push(`Asset ${asset.id}: ${errors.join(', ')}`);
      continue;
    }

    // Check for duplicate (exact hash match)
    const existing = getAsset(normalized.asset_id);
    if (existing) {
      rejectionReasons.push(
        `Asset ${asset.id}: Duplicate asset_id ${normalized.asset_id} already exists`
      );
      continue;
    }

    // Check similarity
    const similarity = checkSimilarity(normalized);
    if (similarity.is_duplicate) {
      const top = similarity.similar_assets[0];
      rejectionReasons.push(
        `Asset ${asset.id}: Too similar to existing asset ${top.asset_id} (${(top.similarity * 100).toFixed(1)}% match)`
      );
      continue;
    }

    // Calculate GDI
    const gdi = calculateGDI(normalized);
    gdiScores[normalized.asset_id] = gdi;

    // Determine initial status
    const status = shouldPromote(gdi) ? 'promoted' : 'candidate';

    // Calculate carbon cost
    const carbonCost = calculateCarbonCost(normalized);
    totalCarbonCost += carbonCost;

    // Save to store
    saveAsset(normalized, ownerId, status, gdi);
    successfulAssets.push(normalized.asset_id);

    // Record rate limit usage
    recordPublish(ownerId);
  }

  // Process evolution event if provided
  if (evolution_event) {
    const normalizedEvt = normalizeAsset(evolution_event) as EvolutionEvent;
    if (!normalizedEvt.asset_id.startsWith('sha256:')) {
      (normalizedEvt as unknown as Record<string, unknown>).asset_id = computeAssetHash(evolution_event);
    }
    saveAsset(normalizedEvt, ownerId, 'candidate');
    gdiScores[normalizedEvt.asset_id] = calculateGDI(normalizedEvt);
  }

  // Build lineage chain for successful bundle
  const gene = assets.find(a => a.type === 'Gene') as Gene | undefined;
  const capsule = assets.find(a => a.type === 'Capsule') as Capsule | undefined;
  if (gene && capsule) {
    const geneRecord = gdiScores[gene.asset_id] ? gene : undefined;
    const capsuleRecord = gdiScores[capsule.asset_id] ? capsule : undefined;
    if (geneRecord && capsuleRecord) {
      buildBundleLineage(geneRecord, capsuleRecord, evolution_event);
    }
  }

  const success = successfulAssets.length === assets.length;
  return {
    status: success ? 'candidate' : 'rejected',
    asset_ids: successfulAssets,
    carbon_cost: totalCarbonCost,
    rejection_reasons: rejectionReasons.length > 0 ? rejectionReasons : undefined,
    gdi_scores: Object.keys(gdiScores).length > 0 ? gdiScores : undefined,
  };
}

export interface ValidationReportParams {
  asset_id: string;
  outcome: { status: 'success' | 'failure'; score: number };
  usage_context?: string;
  reported_by?: string;
  blast_radius?: { files: number; lines: number };
}

/**
 * Submit a validation report for an asset
 */
export function submitValidationReport(
  params: ValidationReportParams
): { success: boolean; reason?: string } {
  const record = getAsset(params.asset_id);

  if (!record) {
    return { success: false, reason: 'Asset not found' };
  }

  if (record.status === 'rejected' || record.status === 'archived') {
    return { success: false, reason: 'Asset is not in an active state' };
  }

  // In a real system, we would:
  // 1. Verify the reporter is a legitimate node
  // 2. Apply reputation impact
  // 3. Update the GDI score based on outcome.score
  // 4. Record usage_context and blast_radius for analytics

  return { success: true };
}

/**
 * Revoke an asset
 */
export function revokeAsset(
  assetId: string,
  ownerId: string,
  reason?: string
): { success: boolean; error?: string } {
  const record = getAsset(assetId);

  if (!record) {
    return { success: false, error: 'Asset not found' };
  }

  if (record.owner_id !== ownerId) {
    return { success: false, error: 'Not authorized to revoke this asset' };
  }

  // Mark as archived (soft delete)
  const { updateAssetStatus } = require('./store');
  updateAssetStatus(assetId, 'archived', reason);

  return { success: true };
}
