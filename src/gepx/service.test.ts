/**
 * Unit tests for src/gepx modules:
 * - serializer
 * - checksum
 * - compatibility
 * - schema
 * - service (integration)
 */

import * as serializer from './serializer';
import * as checksum from './checksum';
import * as compatibility from './compatibility';
import * as schema from './schema';
import * as service from './service';
import { GepxBundle, BundleType } from './types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeBundle(overrides: Partial<GepxBundle> = {}): GepxBundle {
  const now = new Date();
  return {
    bundle_id: 'test-bundle-001',
    bundle_type: 'FullSnapshot' as BundleType,
    name: 'Test Bundle',
    description: 'A bundle for unit testing',
    tags: ['test', 'unit'],
    exported_by: 'node-001',
    asset_count: 2,
    checksum: '',
    size_bytes: 0,
    created_at: now,
    ...overrides,
  };
}

function finalizeBundle(b: GepxBundle): GepxBundle {
  const raw = serializer.buildBundle({
    bundleId: b.bundle_id,
    bundleType: b.bundle_type,
    name: b.name,
    description: b.description,
    tags: b.tags,
    exportedBy: b.exported_by,
    assetCount: b.asset_count,
    createdAt: b.created_at,
  });
  return { ...b, checksum: raw.checksum, size_bytes: raw.size_bytes };
}

// ---------------------------------------------------------------------------
// serializer.spec.ts
// ---------------------------------------------------------------------------

describe('serializer', () => {
  describe('serialize / deserialize', () => {
    it('should round-trip a bundle through JSON', () => {
      const bundle = finalizeBundle(makeBundle());
      const json = serializer.serialize(bundle);
      expect(typeof json).toBe('string');
      expect(json.length).toBeGreaterThan(0);

      const parsed = serializer.deserialize(json);
      expect(parsed.bundle_type).toBe(bundle.bundle_type);
      expect(parsed.metadata.bundle_name).toBe(bundle.name);
      expect(parsed.metadata.format_version).toBe('1.0.0');
    });

    it('should throw on invalid JSON input', () => {
      expect(() => serializer.deserialize('not json')).toThrow();
      expect(() => serializer.deserialize('')).toThrow();
      // A bare JSON primitive is valid JSON but not an object payload
      expect(() => serializer.deserialize('123')).toThrow();
    });
  });

  describe('toBase64 / fromBase64', () => {
    it('should round-trip a bundle through base64', () => {
      const bundle = finalizeBundle(makeBundle());
      const b64 = serializer.toBase64(bundle);
      expect(typeof b64).toBe('string');
      // base64 chars only (with padding)
      expect(b64).toMatch(/^[A-Za-z0-9+/=]+$/);

      const parsed = serializer.fromBase64(b64);
      expect(parsed.metadata.bundle_name).toBe(bundle.name);
      expect(parsed.metadata.format_version).toBe('1.0.0');
    });

    it('should throw on invalid base64 input', () => {
      expect(() => serializer.fromBase64('not-valid!!!')).toThrow();
    });
  });

  describe('buildBundle', () => {
    it('should build a bundle with a checksum', () => {
      const bundle = serializer.buildBundle({
        bundleId: 'b-123',
        bundleType: 'Gene',
        name: 'My Gene',
        description: 'Test gene',
        tags: ['gene', 'test'],
        exportedBy: 'node-x',
        assetCount: 1,
        createdAt: new Date('2025-01-01T00:00:00Z'),
      });

      expect(bundle.bundle_id).toBe('b-123');
      expect(bundle.bundle_type).toBe('Gene');
      expect(bundle.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(bundle.size_bytes).toBeGreaterThan(0);
      expect(bundle.created_at).toEqual(new Date('2025-01-01T00:00:00Z'));
    });

    it('should use default values for optional fields', () => {
      const bundle = serializer.buildBundle({
        bundleId: 'b-456',
        bundleType: 'Capsule',
        name: 'Capsule v1',
        description: '',
        exportedBy: 'node-y',
        assetCount: 0,
      });

      expect(bundle.tags).toEqual([]);
      expect(bundle.description).toBe('');
    });

    it('should produce different checksums for different content', () => {
      const b1 = serializer.buildBundle({
        bundleId: 'b-1',
        bundleType: 'Gene',
        name: 'Gene A',
        description: '',
        exportedBy: 'node-x',
        assetCount: 1,
      });
      const b2 = serializer.buildBundle({
        bundleId: 'b-2',
        bundleType: 'Gene',
        name: 'Gene B',
        description: '',
        exportedBy: 'node-x',
        assetCount: 1,
      });

      expect(b1.checksum).not.toBe(b2.checksum);
    });
  });

  describe('binary encode / decode', () => {
    it('should round-trip a payload through the binary gepx format', async () => {
      const bundle = finalizeBundle(makeBundle());
      const payload = serializer.deserialize(serializer.serialize(bundle));
      const encoded = serializer.encodeGepxBundle(payload, true);

      expect(encoded.subarray(0, 4).toString('ascii')).toBe('GEPX');
      expect(encoded.readUInt8(4)).toBe(0x01);
      expect(encoded.readUInt8(5)).toBe(0x01);

      const decoded = await serializer.decodeGepxBuffer(encoded);
      expect(decoded.bundle_type).toBe(payload.bundle_type);
      expect(decoded.metadata.bundle_name).toBe(payload.metadata.bundle_name);
    });

    it('should reject invalid magic bytes during decode', () => {
      const bad = Buffer.from('NOPEbadbundle');
      expect(() => serializer.decodeGepxBufferSync(bad)).toThrow(/magic/i);
    });
  });
});

// ---------------------------------------------------------------------------
// checksum.spec.ts
// ---------------------------------------------------------------------------

describe('checksum', () => {
  describe('calculateChecksum', () => {
    it('should return a 64-character hex string (SHA-256)', () => {
      const bundle = finalizeBundle(makeBundle());
      const cs = checksum.calculateChecksum(bundle);
      expect(cs).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce consistent checksums for the same bundle', () => {
      const bundle = finalizeBundle(makeBundle());
      const cs1 = checksum.calculateChecksum(bundle);
      const cs2 = checksum.calculateChecksum(bundle);
      expect(cs1).toBe(cs2);
    });

    it('should produce different checksums for different bundles', () => {
      const b1 = finalizeBundle(makeBundle({ bundle_id: 'id-1' }));
      const b2 = finalizeBundle(makeBundle({ bundle_id: 'id-2' }));
      expect(checksum.calculateChecksum(b1)).not.toBe(checksum.calculateChecksum(b2));
    });
  });

  describe('verifyChecksum', () => {
    it('should return true for a bundle with a matching checksum', () => {
      const bundle = finalizeBundle(makeBundle());
      expect(checksum.verifyChecksum(bundle)).toBe(true);
    });

    it('should return false for a bundle with a wrong checksum', () => {
      const bundle = { ...finalizeBundle(makeBundle()), checksum: 'a'.repeat(64) };
      expect(checksum.verifyChecksum(bundle)).toBe(false);
    });

    it('should return false for a bundle with an empty checksum', () => {
      const bundle = { ...finalizeBundle(makeBundle()), checksum: '' };
      expect(checksum.verifyChecksum(bundle)).toBe(false);
    });
  });

  describe('generateManifest', () => {
    it('should return a valid manifest object', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);

      expect(manifest.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(manifest.algorithm).toBe('sha256');
      expect(manifest.bundle_id).toBe(bundle.bundle_id);
      expect(manifest.asset_count).toBe(bundle.asset_count);
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });

  describe('verifyManifest', () => {
    it('should return valid=true for a matching manifest', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);
      const result = checksum.verifyManifest(bundle, manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.manifest).not.toBeNull();
    });

    it('should return valid=false on bundle_id mismatch', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);
      const badManifest = { ...manifest, bundle_id: 'wrong-id' };

      const result = checksum.verifyManifest(bundle, badManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('bundle_id'))).toBe(true);
    });

    it('should return valid=false on asset_count mismatch', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);
      const badManifest = { ...manifest, asset_count: 999 };

      const result = checksum.verifyManifest(bundle, badManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('asset_count'))).toBe(true);
    });

    it('should return valid=false on checksum mismatch', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);
      const badManifest = { ...manifest, checksum: 'a'.repeat(64) };

      const result = checksum.verifyManifest(bundle, badManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('checksum'))).toBe(true);
    });

    it('should return valid=false for unsupported algorithm', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = checksum.generateManifest(bundle);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const badManifest = { ...manifest, algorithm: 'md5' } as unknown as import('./types').Manifest;

      const result = checksum.verifyManifest(bundle, badManifest);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('algorithm'))).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// compatibility.spec.ts
// ---------------------------------------------------------------------------

describe('compatibility', () => {
  describe('checkCompatibility', () => {
    it('should return compatible=true for a valid bundle', () => {
      const bundle = finalizeBundle(makeBundle({ bundle_type: 'Gene' }));
      const result = compatibility.checkCompatibility(bundle);
      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should list all supported bundle types as compatible', () => {
      const types: BundleType[] = [
        'Gene',
        'Capsule',
        'EvolutionEvent',
        'Mutation',
        'Recipe',
        'Organism',
        'FullSnapshot',
      ];

      for (const type of types) {
        const bundle = finalizeBundle(makeBundle({ bundle_type: type }));
        const result = compatibility.checkCompatibility(bundle);
        expect(result.compatible).toBe(true);
      }
    });
  });

  describe('isSupported', () => {
    it('should return true for version 1.0.0', () => {
      expect(compatibility.isSupported('1.0.0')).toBe(true);
    });

    it('should return false for version 0.9.0', () => {
      expect(compatibility.isSupported('0.9.0')).toBe(false);
    });

    it('should return true for versions >= minimum', () => {
      expect(compatibility.isSupported('2.0.0')).toBe(true);
      expect(compatibility.isSupported('1.1.0')).toBe(true);
    });
  });

  describe('getRequiredVersion', () => {
    it('should return 1.0.0 for all known bundle types', () => {
      const types: BundleType[] = [
        'Gene',
        'Capsule',
        'EvolutionEvent',
        'Mutation',
        'Recipe',
        'Organism',
        'FullSnapshot',
      ];
      for (const type of types) {
        expect(compatibility.getRequiredVersion(type)).toBe('1.0.0');
      }
    });

    it('should return current version for unknown bundle types', () => {
      expect(
        compatibility.getRequiredVersion('UnknownType' as BundleType),
      ).toBe('1.0.0');
    });
  });

  describe('migrateToVersion', () => {
    it('should return the bundle unchanged for the current version', () => {
      const bundle = finalizeBundle(makeBundle());
      const migrated = compatibility.migrateToVersion(bundle, '1.0.0');
      expect(migrated.bundle_id).toBe(bundle.bundle_id);
    });

    it('should throw for unsupported target versions', () => {
      const bundle = finalizeBundle(makeBundle());
      expect(() =>
        compatibility.migrateToVersion(bundle, '0.1.0'),
      ).toThrow(/not supported/i);
    });

    it('should throw for future target versions', () => {
      const bundle = finalizeBundle(makeBundle());
      expect(() =>
        compatibility.migrateToVersion(bundle, '99.0.0'),
      ).toThrow(/not yet supported/i);
    });
  });

  describe('getVersionMap', () => {
    it('should return a valid version map', () => {
      const map = compatibility.getVersionMap();
      expect(map.current).toBe('1.0.0');
      expect(map.minimum).toBe('1.0.0');
      expect(map.supported).toContain('1.0.0');
    });
  });
});

// ---------------------------------------------------------------------------
// schema.spec.ts
// ---------------------------------------------------------------------------

describe('schema', () => {
  const validPayload = {
    version: '1.0.0',
    exported_at: '2025-01-01T00:00:00.000Z',
    bundle_type: 'FullSnapshot',
    metadata: {
      format_version: '1.0.0',
      hub_version: '1.0.0',
      bundle_name: 'Test',
      description: 'Test bundle',
      tags: ['test'],
      exported_by: 'node-x',
      asset_count: 1,
      checksum: checksum.calculateChecksum(
        finalizeBundle(makeBundle({ asset_count: 1 })),
      ),
    },
    assets: [
      {
        asset_id: 'asset-1',
        asset_type: 'Gene',
        name: 'Test Gene',
        version: '1.0.0',
        content: 'print("hello")',
        tags: [],
      },
    ],
    lineage: [],
  };

  describe('validateSchema', () => {
    it('should return valid=true for a well-formed payload', () => {
      const result = schema.validateSchema(validPayload);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return valid=false for null payload', () => {
      const result = schema.validateSchema(null);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_TYPE')).toBe(true);
    });

    it('should return valid=false for undefined payload', () => {
      const result = schema.validateSchema(undefined);
      expect(result.valid).toBe(false);
    });

    it('should return valid=false for a missing required field', () => {
      const bad = { ...validPayload };
      delete (bad as Record<string, unknown>)['version'];
      const result = schema.validateSchema(bad);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return valid=false for an invalid bundle_type', () => {
      const bad = { ...validPayload, bundle_type: 'InvalidType' };
      const result = schema.validateSchema(bad);
      expect(result.valid).toBe(false);
    });

    it('should return valid=false for negative asset_count', () => {
      const bad = {
        ...validPayload,
        metadata: { ...validPayload.metadata, asset_count: -1 },
      };
      const result = schema.validateSchema(bad);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateAssetObject', () => {
    it('should return valid=true for a well-formed asset', () => {
      const asset = {
        asset_id: 'asset-x',
        asset_type: 'Capsule',
        name: 'My Capsule',
        version: '1.0.0',
        content: 'capsule content here',
        tags: ['tag1'],
      };
      const result = schema.validateAssetObject(asset);
      expect(result.valid).toBe(true);
    });

    it('should return valid=false for null asset', () => {
      const result = schema.validateAssetObject(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]?.code).toBe('INVALID_TYPE');
    });

    it('should return valid=false for a missing required field', () => {
      const asset = { asset_id: 'a-1', name: 'No type' };
      const result = schema.validateAssetObject(asset);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateGene', () => {
    it('should return valid=true for a valid Gene', () => {
      const gene = {
        asset_type: 'Gene',
        name: 'My Gene',
        content: 'def foo(): pass',
        asset_id: 'gene-1',
        version: '1.0.0',
        tags: [],
      };
      const result = schema.validateGene(gene);
      expect(result.valid).toBe(true);
    });

    it('should return valid=false for wrong asset_type', () => {
      const gene = {
        asset_type: 'Capsule',
        name: 'Wrong Type',
        content: 'data',
        asset_id: 'gene-1',
        version: '1.0.0',
        tags: [],
      };
      const result = schema.validateGene(gene);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'INVALID_ASSET_TYPE')).toBe(
        true,
      );
    });

    it('should return valid=false for empty content', () => {
      const gene = {
        asset_type: 'Gene',
        name: 'Empty Gene',
        content: '   ',
        asset_id: 'gene-1',
        version: '1.0.0',
        tags: [],
      };
      const result = schema.validateGene(gene);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'EMPTY_CONTENT')).toBe(true);
    });

    it('should return valid=false for missing name', () => {
      const gene = {
        asset_type: 'Gene',
        content: 'x = 1',
        asset_id: 'gene-1',
        version: '1.0.0',
        tags: [],
      };
      const result = schema.validateGene(gene);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'MISSING_NAME')).toBe(true);
    });

    it('should return valid=false for non-object input', () => {
      const result = schema.validateGene('not an object');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateMetadataObject', () => {
    it('should return valid=true for well-formed metadata', () => {
      const meta = {
        format_version: '1.0.0',
        hub_version: '1.0.0',
        bundle_name: 'Meta Test',
        description: 'desc',
        tags: ['tag'],
        exported_by: 'node-1',
        asset_count: 0,
        checksum: 'abc123',
      };
      const result = schema.validateMetadataObject(meta);
      expect(result.valid).toBe(true);
    });

    it('should return valid=false for non-object input', () => {
      const result = schema.validateMetadataObject(123);
      expect(result.valid).toBe(false);
    });

    it('should return valid=false for missing required fields', () => {
      const result = schema.validateMetadataObject({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

// ---------------------------------------------------------------------------
// service.spec.ts (DB-backed integration — mock Prisma)
// ---------------------------------------------------------------------------

describe('service DB-backed', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  function createMockPrisma() {
    return {
      gepxBundle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        upsert: jest.fn(),
        count: jest.fn(),
      },
      gepxExport: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
      sandboxAsset: {
        findMany: jest.fn(),
      },
    };
  }

  beforeAll(() => {
    mockPrisma = createMockPrisma();
    (service as any).setPrisma(mockPrisma);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listBundles', () => {
    it('should return bundles without bundleType filter', async () => {
      const bundles = [
        { bundle_id: 'b-1', bundle_type: 'Gene', name: 'Bundle 1', description: '', tags: [], exported_by: 'node-x', asset_count: 1, checksum: 'cs1', size_bytes: 100, created_at: new Date() },
        { bundle_id: 'b-2', bundle_type: 'Capsule', name: 'Bundle 2', description: '', tags: [], exported_by: 'node-x', asset_count: 2, checksum: 'cs2', size_bytes: 200, created_at: new Date() },
      ];
      mockPrisma.gepxBundle.findMany.mockResolvedValue(bundles);
      mockPrisma.gepxBundle.count.mockResolvedValue(2);

      const result = await service.listBundles();

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(mockPrisma.gepxBundle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('should filter by bundleType when provided', async () => {
      mockPrisma.gepxBundle.findMany.mockResolvedValue([]);
      mockPrisma.gepxBundle.count.mockResolvedValue(0);

      await service.listBundles('Gene');

      expect(mockPrisma.gepxBundle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { bundle_type: 'Gene' } }),
      );
    });

    it('should apply limit and offset', async () => {
      mockPrisma.gepxBundle.findMany.mockResolvedValue([]);
      mockPrisma.gepxBundle.count.mockResolvedValue(0);

      await service.listBundles(undefined, 10, 5);

      expect(mockPrisma.gepxBundle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 5 }),
      );
    });
  });

  describe('getBundle', () => {
    it('should return a bundle by id', async () => {
      const bundle = {
        bundle_id: 'b-1',
        bundle_type: 'Gene',
        name: 'Test Bundle',
        description: '',
        tags: [],
        exported_by: 'node-x',
        asset_count: 1,
        checksum: 'cs1',
        size_bytes: 100,
        created_at: new Date(),
      };
      mockPrisma.gepxBundle.findUnique.mockResolvedValue(bundle);

      const result = await service.getBundle('b-1');

      expect(result.bundle_id).toBe('b-1');
    });

    it('should throw NotFoundError for unknown bundle', async () => {
      mockPrisma.gepxBundle.findUnique.mockResolvedValue(null);

      await expect(service.getBundle('unknown')).rejects.toThrow('not found');
    });
  });

  describe('createBundle', () => {
    it('should create and return a bundle', async () => {
      const created = {
        bundle_id: expect.stringMatching(/^[a-f0-9-]+$/),
        bundle_type: 'Gene',
        name: 'My Gene',
        description: 'Test gene bundle',
        tags: ['test'],
        exported_by: 'node-x',
        asset_count: 2,
        checksum: expect.any(String),
        size_bytes: expect.any(Number),
        created_at: expect.any(Date),
      };
      mockPrisma.gepxBundle.create.mockResolvedValue(created);

      const result = await service.createBundle(
        'node-x',
        'My Gene',
        'Test gene bundle',
        'Gene',
        ['asset-1', 'asset-2'],
        ['test'],
      );

      expect(result.bundle_type).toBe('Gene');
      expect(result.asset_count).toBe(2);
      expect(mockPrisma.gepxBundle.create).toHaveBeenCalled();
    });

    it('should create bundle without optional tags', async () => {
      const created = {
        bundle_id: expect.stringMatching(/./),
        bundle_type: 'Capsule',
        name: 'Capsule v1',
        description: '',
        tags: [],
        exported_by: 'node-y',
        asset_count: 1,
        checksum: expect.any(String),
        size_bytes: expect.any(Number),
        created_at: expect.any(Date),
      };
      mockPrisma.gepxBundle.create.mockResolvedValue(created);

      const result = await service.createBundle(
        'node-y',
        'Capsule v1',
        '',
        'Capsule',
        ['asset-1'],
      );

      expect(result.tags).toEqual([]);
      expect(mockPrisma.gepxBundle.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ tags: [] }) }),
      );
    });
  });

  describe('downloadBundle', () => {
    it('should return bundle, assets, and export record', async () => {
      const bundle = {
        bundle_id: 'b-1',
        bundle_type: 'Gene',
        name: 'Download Test',
        description: '',
        tags: [],
        exported_by: 'node-x',
        asset_count: 2,
        checksum: 'cs1',
        size_bytes: 100,
        created_at: new Date(),
      };
      const assets = [
        { asset_id: 'a-1', sandbox_id: 'b-1', content: 'code1' },
        { asset_id: 'a-2', sandbox_id: 'b-1', content: 'code2' },
      ];

      mockPrisma.gepxBundle.findUnique.mockResolvedValue(bundle);
      mockPrisma.sandboxAsset.findMany.mockResolvedValue(assets);
      mockPrisma.gepxExport.create.mockResolvedValue({
        export_id: 'exp-1',
        bundle_id: 'b-1',
        node_id: 'node-x',
        format: 'gepx',
        created_at: new Date(),
      });

      const result = await service.downloadBundle('b-1', 'node-x');

      expect(result.bundle.bundle_id).toBe('b-1');
      expect(result.assets).toHaveLength(2);
      expect(result.exportRecord.export_id).toBe('exp-1');
    });

    it('should throw NotFoundError when bundle does not exist', async () => {
      mockPrisma.gepxBundle.findUnique.mockResolvedValue(null);

      await expect(service.downloadBundle('unknown', 'node-x')).rejects.toThrow('not found');
    });
  });

  describe('listExports', () => {
    it('should return export records for a node', async () => {
      const exports = [
        { export_id: 'exp-1', bundle_id: 'b-1', node_id: 'node-x', format: 'gepx', created_at: new Date() },
        { export_id: 'exp-2', bundle_id: 'b-2', node_id: 'node-x', format: 'gepx', created_at: new Date() },
      ];
      mockPrisma.gepxExport.findMany.mockResolvedValue(exports);

      const result = await service.listExports('node-x');

      expect(result).toHaveLength(2);
      expect(mockPrisma.gepxExport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { node_id: 'node-x' } }),
      );
    });
  });

  describe('importBundle', () => {
    it('should import a bundle and create export record', async () => {
      const imported = {
        bundle_id: 'b-imported',
        bundle_type: 'Gene',
        name: 'Imported Bundle',
        description: '',
        tags: ['imported'],
        exported_by: 'node-x',
        asset_count: 1,
        checksum: 'imported-checksum',
        size_bytes: 0,
        created_at: expect.any(Date),
      };
      mockPrisma.gepxBundle.upsert.mockResolvedValue(imported);
      mockPrisma.gepxExport.create.mockResolvedValue({
        export_id: 'exp-new',
        bundle_id: 'b-imported',
        node_id: 'node-x',
        format: 'gepx',
        created_at: new Date(),
      });

      const bundleData = {
        bundle_id: 'b-imported',
        name: 'Imported Bundle',
        bundle_type: 'Gene',
        assets: [{ asset_id: 'a-1' }],
        tags: ['imported'],
        checksum: 'imported-checksum',
      };

      const result = await service.importBundle('node-x', bundleData);

      expect(result.imported.bundle_id).toBe('b-imported');
      expect(result.skipped).toBe(0);
      expect(mockPrisma.gepxBundle.upsert).toHaveBeenCalled();
      expect(mockPrisma.gepxExport.create).toHaveBeenCalled();
    });

    it('should use defaults when optional fields are missing', async () => {
      const imported = {
        bundle_id: expect.stringMatching(/./),
        bundle_type: 'unknown',
        name: 'Imported Bundle',
        description: '',
        tags: [],
        exported_by: 'node-x',
        asset_count: 0,
        checksum: expect.any(String),
        size_bytes: 0,
        created_at: expect.any(Date),
      };
      mockPrisma.gepxBundle.upsert.mockResolvedValue(imported);
      mockPrisma.gepxExport.create.mockResolvedValue({
        export_id: 'exp-new',
        bundle_id: 'b-new',
        node_id: 'node-x',
        format: 'gepx',
        created_at: new Date(),
      });

      const bundleData = {}; // no fields at all

      const result = await service.importBundle('node-x', bundleData);

      expect(result.imported.name).toBe('Imported Bundle');
      expect(result.imported.bundle_type).toBe('unknown');
      expect(mockPrisma.gepxBundle.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ tags: [] }),
        }),
      );
    });

    it('should throw ValidationError when bundleData is not an object', async () => {
      await expect(service.importBundle('node-x', null as any)).rejects.toThrow('Invalid bundle_data');
      await expect(service.importBundle('node-x', 'string' as any)).rejects.toThrow('Invalid bundle_data');
      await expect(service.importBundle('node-x', 123 as any)).rejects.toThrow('Invalid bundle_data');
    });
  });
});

describe('service misc', () => {
  describe('isVersionSupported', () => {
    it('should return true for supported versions', () => {
      expect(service.isVersionSupported('1.0.0')).toBe(true);
      expect(service.isVersionSupported('2.0.0')).toBe(true);
      expect(service.isVersionSupported('1.1.0')).toBe(true);
    });

    it('should return false for unsupported versions', () => {
      expect(service.isVersionSupported('0.9.0')).toBe(false);
      expect(service.isVersionSupported('0.0.1')).toBe(false);
    });
  });
});

describe('service', () => {
  describe('serializer integration', () => {
    it('should serialize and deserialize through service', () => {
      const bundle = finalizeBundle(makeBundle({ bundle_type: 'Gene' }));
      const json = service.serializeToJson(bundle);
      const parsed = service.deserializeFromJson(json);
      expect(parsed.metadata.bundle_name).toBe(bundle.name);
    });

    it('should convert to base64 and back through service', () => {
      const bundle = finalizeBundle(makeBundle());
      const b64 = service.bundleToBase64(bundle);
      const parsed = service.bundleFromBase64(b64);
      expect(parsed.metadata.bundle_name).toBe(bundle.name);
    });
  });

  describe('checksum integration', () => {
    it('should calculate and verify checksum through service', () => {
      const bundle = finalizeBundle(makeBundle());
      const cs = service.calcChecksum(bundle);
      expect(cs).toMatch(/^[a-f0-9]{64}$/);
      expect(service.verifyBundleChecksum(bundle)).toBe(true);
    });

    it('should generate and verify manifest through service', () => {
      const bundle = finalizeBundle(makeBundle());
      const manifest = service.genManifest(bundle);
      const result = service.verifyBundleManifest(bundle, manifest);
      expect(result.valid).toBe(true);
    });
  });

  describe('compatibility integration', () => {
    it('should check compatibility through service', () => {
      const bundle = finalizeBundle(makeBundle({ bundle_type: 'Recipe' }));
      const result = service.checkBundleCompatibility(bundle);
      expect(result.compatible).toBe(true);
    });

    it('should check version support through service', () => {
      expect(service.isVersionSupported('1.0.0')).toBe(true);
      expect(service.isVersionSupported('0.9.0')).toBe(false);
    });
  });

  describe('schema integration', () => {
    it('should validate a payload through service', () => {
      const bundle = finalizeBundle(makeBundle({ asset_count: 1 }));
      const json = service.serializeToJson(bundle);
      const parsed = JSON.parse(json);
      const result = service.validateGepxPayload(parsed);
      expect(result.valid).toBe(true);
    });

    it('should validate an asset through service', () => {
      const asset = {
        asset_id: 'a-1',
        asset_type: 'Gene',
        name: 'Test',
        version: '1.0.0',
        content: 'x = 1',
        tags: [],
      };
      expect(service.validateAssetObject(asset).valid).toBe(true);
      expect(service.validateGeneAsset({ asset_type: 'Capsule', content: '', name: '' }).valid).toBe(false);
    });
  });

  describe('exportBundle', () => {
    it('should produce a complete export result', () => {
      const result = service.exportBundle({
        name: 'Export Test',
        description: 'Integration export test',
        bundleType: 'Gene',
        exportedBy: 'node-export-1',
        assetIds: ['asset-a', 'asset-b'],
        tags: ['exported'],
      });

      expect(result.bundle.bundle_type).toBe('Gene');
      expect(result.json.length).toBeGreaterThan(0);
      expect(result.base64.length).toBeGreaterThan(0);
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(result.manifest.checksum).toBe(result.checksum);
      expect(result.validation.valid).toBe(true);
      expect(result.compatibility.compatible).toBe(true);
    });
  });

  describe('binary helpers', () => {
    it('should validate binary gepx buffers through service', () => {
      const bundle = finalizeBundle(makeBundle());
      const payload = serializer.deserialize(serializer.serialize(bundle));
      const buffer = service.encodeBundleToBinary(payload, false);
      const result = service.validateGepxBinary(buffer);

      expect(result.valid).toBe(true);
      expect(result.bundle_type).toBe(payload.bundle_type);
      expect(result.compressed).toBe(false);
    });
  });
});
