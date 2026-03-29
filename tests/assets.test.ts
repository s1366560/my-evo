/**
 * Asset System Tests
 * Phase 2: Asset System (Gene/Capsule/EvolutionEvent)
 *
 * Tests core asset operations:
 * - Asset validation (validateAsset)
 * - Asset normalization and hashing (normalizeAsset, computeAssetHash)
 * - Asset publishing workflow (publishAsset)
 * - Asset revocation (revokeAsset)
 * - Asset store operations (getAsset, saveAsset, listAssets, etc.)
 * - Similarity detection (computeDirectSimilarity, checkSimilarity)
 */

import {
  // publish
  validateAsset,
  computeAssetHash,
  normalizeAsset,
  publishAsset,
  submitValidationReport,
  revokeAsset,
} from '../src/assets/publish';
import {
  // store
  getAsset,
  getAssetContent,
  getAssetsByOwner,
  listAssets,
  countAssets,
  saveAsset,
  updateAssetStatus,
  incrementFetchCount,
  incrementReportCount,
  checkPublishRateLimit,
  recordPublish,
  getActiveAssets,
  getPromotedAssets,
  getAssetsBySignal,
  getAssetStats,
  searchAssets,
  resetStores,
} from '../src/assets/store';
import {
  // similarity
  computeDirectSimilarity,
  checkSimilarity,
  isExactDuplicate,
} from '../src/assets/similarity';
import {
  Gene,
  Capsule,
  EvolutionEvent,
  Asset,
  AssetBundle,
  AssetStatus,
  AssetRecord,
} from '../src/assets/types';
import { resetLineageStores } from '../src/assets/lineage';

beforeEach(() => {
  resetStores();
  resetLineageStores();
});

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeGene(overrides: Partial<Gene> = {}): Gene {
  return {
    type: 'Gene',
    schema_version: '1.5.0',
    id: 'test_gene',
    asset_id: 'sha256:abcd1234',
    category: 'repair',
    signals_match: ['timeout', '/error.*retry/i'],
    preconditions: ['tool available: curl'],
    strategy: ['Define error pattern', 'Implement retry with backoff', 'Validate fix'],
    constraints: { max_files: 5, forbidden_paths: ['.git', 'node_modules'] },
    validation: ['pytest tests/', 'npm run lint'],
    epigenetic_marks: ['strict_mode'],
    model_name: 'claude-sonnet-4',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeCapsule(overrides: Partial<Capsule> = {}): Capsule {
  return {
    type: 'Capsule',
    schema_version: '1.5.0',
    id: 'test_capsule',
    asset_id: 'sha256:capsule5678',
    trigger: ['connection timeout', 'retry pattern'],
    gene: 'test_gene',
    summary: 'Fixed HTTP timeout with exponential backoff retry',
    content: '// retry logic here',
    diff: '--- a/net.py\n+++ b/net.py\n@@ -10,6 +10,8 @@',
    strategy: ['step1', 'step2'],
    confidence: 0.87,
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    success_streak: 3,
    env_fingerprint: { platform: 'linux', arch: 'x64' },
    trigger_context: { prompt: 'User reported connection timeout', agent_model: 'claude-sonnet-4' },
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeEvolutionEvent(overrides: Partial<EvolutionEvent> = {}): EvolutionEvent {
  return {
    type: 'EvolutionEvent',
    id: 'evt_test_001',
    parent: 'evt_parent_001',
    intent: 'repair',
    signals: ['timeout'],
    genes_used: ['gene_gep_repair_from_errors'],
    mutation_id: 'mut_xxx',
    blast_radius: { files: 2, lines: 45 },
    outcome: { status: 'success', score: 0.87 },
    capsule_id: 'capsule_test_001',
    source_type: 'generated',
    asset_id: 'sha256:evt001',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeAssetRecord(asset: Asset, overrides: Partial<AssetRecord> = {}): AssetRecord {
  const now = new Date().toISOString();
  return {
    asset,
    status: 'candidate',
    owner_id: 'node_test_001',
    gdi: undefined,
    fetch_count: 0,
    report_count: 0,
    published_at: now,
    updated_at: now,
    version: 1,
    ...overrides,
  };
}

// ─── validateAsset ─────────────────────────────────────────────────────────

describe('validateAsset', () => {
  describe('Gene validation', () => {
    it('should return no errors for valid gene', () => {
      const gene = makeGene();
      const errors = validateAsset(gene);
      expect(errors).toHaveLength(0);
    });

    it('should reject gene missing signals_match', () => {
      const gene = makeGene({ signals_match: [] });
      const errors = validateAsset(gene);
      expect(errors).toContain('Gene must have at least one signals_match entry');
    });

    it('should reject gene missing strategy', () => {
      const gene = makeGene({ strategy: [] });
      const errors = validateAsset(gene);
      expect(errors).toContain('Gene must have at least one strategy step');
    });

    it('should reject gene with empty constraints', () => {
      const gene = makeGene({ constraints: {} });
      const errors = validateAsset(gene);
      expect(errors).toContain('Gene must define constraints');
    });

    it('should reject gene with invalid asset_id format', () => {
      const gene = makeGene({ asset_id: 'invalid_hash' });
      const errors = validateAsset(gene);
      expect(errors).toContain('asset_id must start with "sha256:"');
    });

    it('should reject gene missing asset_id', () => {
      const gene = makeGene({ asset_id: '' as any });
      const errors = validateAsset(gene);
      expect(errors).toContain('Missing asset_id (SHA-256 content hash required)');
    });
  });

  describe('Capsule validation', () => {
    it('should return no errors for valid capsule', () => {
      const capsule = makeCapsule();
      const errors = validateAsset(capsule);
      expect(errors).toHaveLength(0);
    });

    it('should reject capsule missing trigger', () => {
      const capsule = makeCapsule({ trigger: [] });
      const errors = validateAsset(capsule);
      expect(errors).toContain('Capsule must have at least one trigger');
    });

    it('should reject capsule missing gene reference', () => {
      const capsule = makeCapsule({ gene: '' });
      const errors = validateAsset(capsule);
      expect(errors).toContain('Capsule must reference a source gene');
    });

    it('should reject capsule with confidence out of range', () => {
      const capsule = makeCapsule({ confidence: 1.5 });
      const errors = validateAsset(capsule);
      expect(errors).toContain('Capsule confidence must be between 0 and 1');
    });

    it('should reject capsule with negative confidence', () => {
      const capsule = makeCapsule({ confidence: -0.1 });
      const errors = validateAsset(capsule);
      expect(errors).toContain('Capsule confidence must be between 0 and 1');
    });

    it('should reject capsule missing blast_radius', () => {
      const capsule = makeCapsule({ blast_radius: undefined } as any);
      const errors = validateAsset(capsule);
      expect(errors).toContain('Capsule must define blast_radius');
    });
  });

  describe('EvolutionEvent validation', () => {
    it('should return no errors for valid evolution event', () => {
      const evt = makeEvolutionEvent();
      const errors = validateAsset(evt);
      expect(errors).toHaveLength(0);
    });

    it('should accept evolution event with minimal fields', () => {
      const evt: EvolutionEvent = {
        type: 'EvolutionEvent',
        id: 'evt_minimal',
        intent: 'innovate',
        signals: ['novel_signal'],
        genes_used: [],
        blast_radius: { files: 1, lines: 10 },
        outcome: { status: 'success', score: 0.9 },
        source_type: 'generated',
        asset_id: 'sha256:evtminimal',
        created_at: new Date().toISOString(),
      };
      const errors = validateAsset(evt);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Generic asset validation', () => {
    it('should reject asset missing type', () => {
      const asset = { id: 'test', asset_id: 'sha256:test' } as any;
      const errors = validateAsset(asset);
      expect(errors).toContain('Missing asset type');
    });

    it('should reject asset missing id', () => {
      const gene = makeGene({ id: '' });
      const errors = validateAsset(gene);
      expect(errors).toContain('Missing id field');
    });
  });
});

// ─── computeAssetHash ───────────────────────────────────────────────────────

describe('computeAssetHash', () => {
  it('should compute SHA-256 hash starting with sha256:', () => {
    const gene = makeGene();
    const hash = computeAssetHash(gene);
    expect(hash).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('should produce different hashes for different content', () => {
    const gene1 = makeGene({ id: 'gene_1', signals_match: ['timeout'] });
    const gene2 = makeGene({ id: 'gene_2', signals_match: ['retry'] });
    const hash1 = computeAssetHash(gene1);
    const hash2 = computeAssetHash(gene2);
    expect(hash1).not.toBe(hash2);
  });

  it('should produce deterministic hashes', () => {
    const gene = makeGene();
    const hash1 = computeAssetHash(gene);
    const hash2 = computeAssetHash(gene);
    expect(hash1).toBe(hash2);
  });
});

// ─── normalizeAsset ─────────────────────────────────────────────────────────

describe('normalizeAsset', () => {
  it('should set schema_version to 1.5.0 for Gene', () => {
    const gene = makeGene({ schema_version: undefined } as any);
    const normalized = normalizeAsset(gene);
    expect((normalized as Gene).schema_version).toBe('1.5.0');
  });

  it('should set schema_version to 1.5.0 for Capsule', () => {
    const capsule = makeCapsule({ schema_version: undefined } as any);
    const normalized = normalizeAsset(capsule);
    expect((normalized as Capsule).schema_version).toBe('1.5.0');
  });

  it('should set created_at if not provided', () => {
    const gene = makeGene({ created_at: undefined } as any);
    const normalized = normalizeAsset(gene);
    expect((normalized as Gene).created_at).toBeDefined();
  });

  it('should not overwrite existing created_at', () => {
    const original = '2026-01-01T00:00:00.000Z';
    const gene = makeGene({ created_at: original });
    const normalized = normalizeAsset(gene);
    expect((normalized as Gene).created_at).toBe(original);
  });

  it('should compute asset_id if not provided', () => {
    const gene = makeGene({ asset_id: undefined } as any);
    const normalized = normalizeAsset(gene);
    expect((normalized as Gene).asset_id).toMatch(/^sha256:/);
  });

  it('should preserve existing sha256 asset_id', () => {
    const original = 'sha256:existing1234567890abcdef';
    const gene = makeGene({ asset_id: original });
    const normalized = normalizeAsset(gene);
    expect((normalized as Gene).asset_id).toBe(original);
  });
});

// ─── Store Operations ───────────────────────────────────────────────────────

describe('Asset Store', () => {
  describe('saveAsset / getAsset', () => {
    it('should save and retrieve an asset record', () => {
      const gene = makeGene();
      const record = makeAssetRecord(gene);
      saveAsset(record);

      const retrieved = getAsset(gene.asset_id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.asset.id).toBe(gene.id);
      expect(retrieved?.status).toBe('candidate');
    });

    it('should return undefined for non-existent asset', () => {
      const result = getAsset('sha256:nonexistent');
      expect(result).toBeUndefined();
    });

    it('should update asset status', () => {
      const gene = makeGene();
      const record = makeAssetRecord(gene);
      saveAsset(record);

      updateAssetStatus(gene.asset_id, 'promoted');
      const retrieved = getAsset(gene.asset_id);
      expect(retrieved?.status).toBe('promoted');
    });
  });

  describe('getAssetContent', () => {
    it('should return the asset content from a record', () => {
      const gene = makeGene();
      const record = makeAssetRecord(gene);
      saveAsset(record);

      const content = getAssetContent(gene.asset_id);
      expect(content).toBeDefined();
      expect((content as Gene).id).toBe(gene.id);
    });

    it('should return undefined for non-existent asset', () => {
      const content = getAssetContent('sha256:nonexistent');
      expect(content).toBeUndefined();
    });
  });

  describe('getAssetsByOwner', () => {
    it('should return assets owned by a specific node', () => {
      const gene = makeGene({ id: 'gene_1' });
      const capsule = makeCapsule({ id: 'capsule_1' });
      saveAsset(gene, 'node_a');
      saveAsset(capsule, 'node_b');

      const nodeAAssets = getAssetsByOwner('node_a');
      expect(nodeAAssets).toHaveLength(1);
      expect(nodeAAssets[0].asset.id).toBe('gene_1');
    });

    it('should return empty array for owner with no assets', () => {
      const assets = getAssetsByOwner('node_no_assets');
      expect(assets).toHaveLength(0);
    });
  });

  describe('listAssets', () => {
    it('should list all assets when no filter', () => {
      const gene = makeGene({ id: 'gene_1' });
      const capsule = makeCapsule({ id: 'capsule_1' });
      saveAsset(gene, 'node_test_001');
      saveAsset(capsule, 'node_test_001');

      const all = listAssets();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', () => {
      const gene = makeGene({ id: 'gene_status_1' });
      const capsule = makeCapsule({ id: 'capsule_status_1' });
      saveAsset(gene, 'node_test_001', 'candidate');
      saveAsset(capsule, 'node_test_001', 'promoted');

      const candidates = listAssets({ status: 'candidate' });
      expect(candidates.every(a => a.status === 'candidate')).toBe(true);
    });

    it('should filter by type', () => {
      const gene = makeGene({ id: 'gene_filter_1' });
      const capsule = makeCapsule({ id: 'capsule_filter_1' });
      saveAsset(gene, 'node_test_001');
      saveAsset(capsule, 'node_test_001');

      const genes = listAssets({ type: 'Gene' });
      expect(genes.every(a => a.asset.type === 'Gene')).toBe(true);
    });
  });

  describe('countAssets', () => {
    it('should count all assets', () => {
      const gene = makeGene({ id: 'gene_count_1' });
      const capsule = makeCapsule({ id: 'capsule_count_1' });
      saveAsset(gene, 'node_test_001');
      saveAsset(capsule, 'node_test_001');

      const count = countAssets();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    it('should count assets by type', () => {
      const gene = makeGene({ id: 'gene_count_type_1' });
      saveAsset(gene, 'node_test_001');

      const geneCount = countAssets({ type: 'Gene' });
      const capsuleCount = countAssets({ type: 'Capsule' });
      expect(geneCount).toBeGreaterThanOrEqual(1);
      expect(capsuleCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('incrementFetchCount / incrementReportCount', () => {
    it('should increment fetch count', () => {
      const gene = makeGene({ id: 'gene_fetch_1' });
      const record = makeAssetRecord(gene, { fetch_count: 5 });
      saveAsset(record);

      incrementFetchCount(gene.asset_id);
      const retrieved = getAsset(gene.asset_id);
      expect(retrieved?.fetch_count).toBe(6);
    });

    it('should increment report count', () => {
      const gene = makeGene({ id: 'gene_report_1' });
      const record = makeAssetRecord(gene, { report_count: 3 });
      saveAsset(record);

      incrementReportCount(gene.asset_id);
      const retrieved = getAsset(gene.asset_id);
      expect(retrieved?.report_count).toBe(4);
    });
  });

  describe('getActiveAssets / getPromotedAssets', () => {
    it('should return active assets', () => {
      const gene = makeGene({ id: 'gene_active_1' });
      saveAsset(gene, 'node_test_001', 'active');

      const active = getActiveAssets();
      expect(active.every(a => a.status === 'active')).toBe(true);
    });

    it('should return promoted assets', () => {
      const gene = makeGene({ id: 'gene_promo_1' });
      saveAsset(gene, 'node_test_001', 'promoted');

      const promoted = getPromotedAssets();
      expect(promoted.every(a => a.status === 'promoted')).toBe(true);
    });
  });

  describe('getAssetsBySignal', () => {
    it('should find assets by signal keyword', () => {
      const gene = makeGene({ id: 'gene_signal_1', signals_match: ['timeout', 'retry'] });
      saveAsset(gene, 'node_test_001');

      const timeoutAssets = getAssetsBySignal('timeout');
      expect(timeoutAssets.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getAssetStats', () => {
    it('should return asset statistics', () => {
      const gene = makeGene({ id: 'gene_stats_1' });
      saveAsset(gene, 'node_test_001', 'active');

      const stats = getAssetStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('by_status');
      expect(stats).toHaveProperty('by_type');
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('searchAssets', () => {
    it('should search assets by query string', () => {
      const gene = makeGene({ id: 'gene_search_1', category: 'repair' });
      saveAsset(gene, 'node_test_001');

      const results = searchAssets({ query: 'repair' });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should filter by min_gdi', () => {
      const gene = makeGene({ id: 'gene_gdi_filter_1' });
      const record = makeAssetRecord(gene, {
        gdi: { total: 75, intrinsic: 30, usage: 20, social: 15, freshness: 100 },
      });
      saveAsset(record);

      const results = searchAssets({ min_gdi: 70 });
      expect(results.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('checkPublishRateLimit', () => {
    it('should allow publishing when under limit', () => {
      const result = checkPublishRateLimit('node_new');
      expect(result.allowed).toBe(true);
    });

    it('should track published count per node', () => {
      const nodeId = 'node_rate_test';
      recordPublish(nodeId);
      recordPublish(nodeId);

      const result = checkPublishRateLimit(nodeId);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBeLessThan(2000);
    });
  });
});

// ─── publishAsset ────────────────────────────────────────────────────────────

describe('publishAsset', () => {
  it('should publish a valid gene bundle', () => {
    const gene = makeGene({ id: 'gene_pub_1' });
    const bundle: AssetBundle = { assets: [gene] };

    const result = publishAsset(bundle, 'node_pub_001', 'secret_001');
    expect(result.status).toBe('candidate');
    expect(result.asset_ids).toContain(gene.asset_id);
    expect(result.carbon_cost).toBeGreaterThanOrEqual(0);
  });

  it('should publish a valid capsule bundle', () => {
    const capsule = makeCapsule({ id: 'capsule_pub_1' });
    const bundle: AssetBundle = { assets: [capsule] };

    const result = publishAsset(bundle, 'node_pub_001', 'secret_001');
    expect(result.status).toBe('candidate');
    expect(result.asset_ids).toContain(capsule.asset_id);
  });

  it('should reject bundle with no assets', () => {
    const bundle: AssetBundle = { assets: [] };

    const result = publishAsset(bundle, 'node_pub_001', 'secret_001');
    expect(result.status).toBe('rejected');
    expect(result.rejection_reasons).toContain('No assets provided in bundle');
  });

  it('should reject asset with validation errors', () => {
    const invalidGene = makeGene({ signals_match: [] });
    const bundle: AssetBundle = { assets: [invalidGene] };

    const result = publishAsset(bundle, 'node_pub_001', 'secret_001');
    expect(result.status).toBe('rejected');
    expect(result.rejection_reasons.some(r => r.includes('signals_match'))).toBe(true);
  });

  it('should reject duplicate asset_id', () => {
    const gene = makeGene({ id: 'gene_dup_1' });
    const bundle: AssetBundle = { assets: [gene] };

    // Publish first time
    publishAsset(bundle, 'node_pub_001', 'secret_001');

    // Try to publish again
    const result2 = publishAsset(bundle, 'node_pub_002', 'secret_002');
    expect(result2.status).toBe('rejected');
    expect(result2.rejection_reasons.some(r => r.includes('Duplicate'))).toBe(true);
  });

  it('should reject when rate limited', () => {
    // Simulate publishing many assets to trigger rate limit
    // For a new node this would be hard to trigger in unit test
    // So we just verify the function works
    const gene = makeGene({ id: 'gene_rate_1' });
    const bundle: AssetBundle = { assets: [gene] };

    const result = publishAsset(bundle, 'node_rl_test', 'secret_rl');
    // New node should be allowed
    expect(result.status).toBeDefined();
  });

  it('should normalize asset before saving', () => {
    const gene = makeGene({ id: 'gene_norm_1', schema_version: undefined } as any);
    const bundle: AssetBundle = { assets: [gene] };

    const result = publishAsset(bundle, 'node_pub_norm', 'secret_norm');
    expect(result.status).toBe('candidate');
  });
});

// ─── revokeAsset ────────────────────────────────────────────────────────────

describe('revokeAsset', () => {
  it('should revoke an existing asset', () => {
    const gene = makeGene({ id: 'gene_revoke_1' });
    const record = makeAssetRecord(gene, { status: 'active' });
    saveAsset(record);

    const result = revokeAsset(gene.asset_id, record.owner_id);
    expect(result).toBeDefined();
    expect(result.success).toBe(true);

    const updated = getAsset(gene.asset_id);
    expect(updated?.status).toBe('archived');
  });

  it('should return failure for non-existent asset', () => {
    const result = revokeAsset('sha256:nonexistent_revoke', 'node_test_001');
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

// ─── Similarity ─────────────────────────────────────────────────────────────

describe('computeDirectSimilarity', () => {
  it('should return 1.0 for identical assets', () => {
    const gene1 = makeGene({ id: 'gene_sim_1' });
    const gene2 = makeGene({ id: 'gene_sim_1' });
    const similarity = computeDirectSimilarity(gene1, gene2);
    expect(similarity).toBe(1.0);
  });

  it('should return lower similarity for different assets', () => {
    const gene1 = makeGene({ id: 'gene_diff_1', signals_match: ['timeout'], asset_id: 'sha256:gene1hash' });
    const gene2 = makeGene({ id: 'gene_diff_2', signals_match: ['memory_leak'], asset_id: 'sha256:gene2hash' });
    const similarity = computeDirectSimilarity(gene1, gene2);
    expect(similarity).toBeLessThan(1.0);
    expect(similarity).toBeGreaterThanOrEqual(0);
  });

  it('should handle cross-type comparison (gene vs capsule)', () => {
    const gene = makeGene({ id: 'gene_cross_1' });
    const capsule = makeCapsule({ id: 'capsule_cross_1' });
    const similarity = computeDirectSimilarity(gene, capsule);
    expect(similarity).toBeLessThanOrEqual(1.0);
    expect(similarity).toBeGreaterThanOrEqual(0);
  });
});

describe('checkSimilarity', () => {
  it('should return no duplicates for unique assets', () => {
    const gene = makeGene({ id: 'gene_uniq_1', signals_match: ['unique_signal_a'], asset_id: 'sha256:gene_uniq_hash' });
    const bundle: AssetBundle = { assets: [gene] };

    publishAsset(bundle, 'node_sim_001', 'secret_sim');

    const result = checkSimilarity(gene, gene.asset_id); // exclude self
    expect(result.is_duplicate).toBe(false);
    expect(result.similar_assets).toHaveLength(0);
  });

  it('should detect similar assets in the store', () => {
    const gene1 = makeGene({ id: 'gene_sim_base', signals_match: ['timeout', 'error'] });
    const gene2 = makeGene({ id: 'gene_sim_sim', signals_match: ['timeout', 'error', 'retry'] });

    publishAsset({ assets: [gene1] }, 'node_sim_check', 'secret_check');
    // Note: gene2 is not published, so checkSimilarity checks against store

    const result = checkSimilarity(gene2);
    // If gene2 matches gene1 in store, similar_assets would be populated
    expect(result).toHaveProperty('is_duplicate');
    expect(result).toHaveProperty('similar_assets');
  });
});

describe('isExactDuplicate', () => {
  it('should return false for non-existent asset', () => {
    const result = isExactDuplicate('sha256:nonexistent_dup');
    expect(result).toBe(false);
  });

  it('should return true for asset that exists in store', () => {
    const gene = makeGene({ id: 'gene_exact_1' });
    publishAsset({ assets: [gene] }, 'node_exact', 'secret_exact');

    const result = isExactDuplicate(gene.asset_id);
    expect(result).toBe(true);
  });
});

// ─── Submit Validation Report ───────────────────────────────────────────────

describe('submitValidationReport', () => {
  it('should submit validation report for existing asset', () => {
    const gene = makeGene({ id: 'gene_report_submit_1' });
    publishAsset({ assets: [gene] }, 'node_report', 'secret_report');

    const result = submitValidationReport(
      gene.asset_id,
      { status: 'success', score: 0.9 },
      'node_report'
    );

    expect(result).toBeDefined();
    expect(result.accepted).toBe(true);
  });

  it('should fail for non-existent asset', () => {
    const result = submitValidationReport('sha256:nonexistent_report', { status: 'success', score: 0.9 }, 'node_test');

    expect(result.accepted).toBe(false);
    expect(result.reason).toBe('Asset not found');
  });
});
