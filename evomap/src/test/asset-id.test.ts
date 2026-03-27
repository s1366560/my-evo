/**
 * EvoMap GEP Protocol - Tests
 */

import { describe, it, expect } from 'vitest';
import {
  computeAssetId,
  canonicalJson,
  sortKeys,
  removeField,
  generateNodeId,
  generateBundleId,
  sha256,
  verifyAssetId,
} from './utils/crypto.js';
import { createGene, createCapsule, createEvolutionEvent } from './models/assets.js';

describe('Crypto Utilities', () => {
  it('should sort object keys recursively', () => {
    const input = { z: 1, a: { y: 2, x: 3 }, b: 4 };
    const result = sortKeys(input);
    
    expect(Object.keys(result)).toEqual(['a', 'b', 'z']);
    expect(Object.keys(result.a)).toEqual(['x', 'y']);
  });

  it('should produce canonical JSON with sorted keys', () => {
    const obj1 = { b: 2, a: 1 };
    const obj2 = { a: 1, b: 2 };
    
    expect(canonicalJson(obj1)).toBe(canonicalJson(obj2));
    expect(canonicalJson(obj1)).toBe('{"a":1,"b":2}');
  });

  it('should remove field without mutation', () => {
    const original = { a: 1, b: 2, c: 3 };
    const result = removeField(original, 'b');
    
    expect(result).toEqual({ a: 1, c: 3 });
    expect(original).toEqual({ a: 1, b: 2, c: 3 }); // Original unchanged
  });

  it('should compute consistent SHA-256 hashes', () => {
    const data = 'hello world';
    const hash1 = sha256(data);
    const hash2 = sha256(data);
    
    expect(hash1).toBe(hash2);
    expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex chars
  });

  it('should generate unique node IDs', () => {
    const id1 = generateNodeId();
    const id2 = generateNodeId();
    
    expect(id1).toMatch(/^node_[a-f0-9]{32}$/);
    expect(id2).toMatch(/^node_[a-f0-9]{32}$/);
    expect(id1).not.toBe(id2);
  });

  it('should generate unique bundle IDs', () => {
    const id1 = generateBundleId();
    const id2 = generateBundleId();
    
    expect(id1).toMatch(/^bundle_[a-f0-9]{32}$/);
    expect(id1).not.toBe(id2);
  });
});

describe('Asset ID Computation', () => {
  it('should compute asset_id from Gene', () => {
    const gene = createGene({
      owner_id: 'node_123',
      signals_match: ['error', 'memory'],
      strategy: { approach: 'reduce_allocation' },
    });
    
    const assetId = computeAssetId(gene);
    
    expect(assetId).toMatch(/^[a-f0-9]{64}$/);
  });

  it('should compute same ID for same content', () => {
    const gene1 = createGene({
      owner_id: 'node_123',
      signals_match: ['error'],
      strategy: { approach: 'fix' },
    });
    
    const gene2 = createGene({
      owner_id: 'node_123',
      signals_match: ['error'],
      strategy: { approach: 'fix' },
    });
    
    expect(computeAssetId(gene1)).toBe(computeAssetId(gene2));
  });

  it('should compute different ID for different content', () => {
    const gene1 = createGene({
      owner_id: 'node_123',
      signals_match: ['error'],
      strategy: { approach: 'fix_v1' },
    });
    
    const gene2 = createGene({
      owner_id: 'node_123',
      signals_match: ['error'],
      strategy: { approach: 'fix_v2' },
    });
    
    expect(computeAssetId(gene1)).not.toBe(computeAssetId(gene2));
  });

  it('should verify valid asset ID', () => {
    const capsule = createCapsule({
      owner_id: 'node_456',
      trigger: { description: 'memory leak' },
      diff: { files: [{ path: 'src/main.js', operation: 'update' }] },
      confidence: 0.9,
      blast_radius: { files: 1, lines: 10, scope: 'local' },
    });
    
    const assetId = computeAssetId(capsule);
    const assetWithId = { ...capsule, asset_id: assetId };
    
    expect(verifyAssetId(assetWithId)).toBe(true);
  });

  it('should reject invalid asset ID', () => {
    const gene = createGene({
      owner_id: 'node_789',
      signals_match: ['bug'],
      strategy: { approach: 'patch' },
    });
    
    const assetWithWrongId = { ...gene, asset_id: 'invalid_hash' };
    
    expect(verifyAssetId(assetWithWrongId)).toBe(false);
  });
});

describe('Asset Creation', () => {
  it('should create Gene with required fields', () => {
    const gene = createGene({
      owner_id: 'node_test',
      signals_match: ['error'],
      strategy: { approach: 'test' },
    });
    
    expect(gene.type).toBe('Gene');
    expect(gene.status).toBe('DRAFT');
    expect(gene.created_at).toBeDefined();
    expect(gene.updated_at).toBeDefined();
    expect(gene.signals_match).toEqual(['error']);
  });

  it('should create Capsule with required fields', () => {
    const capsule = createCapsule({
      owner_id: 'node_test',
      trigger: { description: 'test' },
      diff: { files: [] },
      confidence: 0.8,
      blast_radius: { files: 0, lines: 0, scope: 'local' },
    });
    
    expect(capsule.type).toBe('Capsule');
    expect(capsule.confidence).toBe(0.8);
  });

  it('should create EvolutionEvent with required fields', () => {
    const event = createEvolutionEvent({
      owner_id: 'node_test',
      capsule_id: 'capsule_123',
      intent: 'fix bug',
      genes_used: ['gene_1'],
      outcome: { status: 'success' },
    });
    
    expect(event.type).toBe('EvolutionEvent');
    expect(event.outcome.status).toBe('success');
  });
});

describe('Canonical JSON Determinism', () => {
  it('should produce same JSON for same data regardless of key order', () => {
    const data = {
      z: 1,
      a: { z: 1, a: 1 },
      m: { b: 2, c: 3 },
    };
    
    const json1 = canonicalJson(data);
    const json2 = canonicalJson({
      a: { a: 1, z: 1 },
      m: { c: 3, b: 2 },
      z: 1,
    });
    
    expect(json1).toBe(json2);
  });
});
