/**
 * GEPX Module Tests
 * Chapter 31: Portable Asset Archive Format
 */

import { encodeGepxBundle, encodeSingleAsset } from '../src/gepx/encode';
import { decodeGepxBuffer, validateGepxPayload, extractAssets } from '../src/gepx/decode';
import { GEPX_MAGIC, GEPX_VERSION } from '../src/gepx/types';
import type { AssetRecord } from '../src/gepx/types';

// Helper: create a mock AssetRecord
function makeMockRecord(type: 'Gene' | 'Capsule' = 'Gene'): AssetRecord {
  const asset = type === 'Gene'
    ? { asset_id: 'gene-test-001', type: 'Gene' as const, name: 'TestGene', signals_match: ['python', 'ml'], code: 'def test(): pass', description: 'A test gene', version: '1.0.0', author: 'test', dependencies: [] }
    : { asset_id: 'capsule-test-001', type: 'Capsule' as const, name: 'TestCapsule', trigger: ['inference'], actions: [], version: '1.0.0' };

  return {
    asset,
    owner_id: 'node-001',
    status: 'active',
    published_at: new Date().toISOString(),
    gdi: { total: 75, intrinsic: 40, usage: 20, social: 15 },
    fetch_count: 42,
    report_count: 3,
    updated_at: new Date().toISOString(),
    version: 1,
  } as unknown as AssetRecord;
}

describe('GEPX Encoder', () => {
  describe('encodeGepxBundle', () => {
    it('should produce a Buffer with valid GEPX header', () => {
      const result = encodeGepxBundle({ records: [makeMockRecord()] });
      const data = result.data;

      // Check magic bytes
      expect(data.subarray(0, 4).equals(GEPX_MAGIC)).toBe(true);
      // Check version
      expect(data[4]).toBe(GEPX_VERSION);
      // Check flags (should have gzip bit set)
      expect(data[5] & 0x01).toBe(1);
      // Check payload length
      const payloadLen = data.readUInt32BE(6);
      expect(payloadLen).toBeGreaterThan(0);
      expect(data.length).toBe(10 + payloadLen);
    });

    it('should encode asset data correctly', () => {
      const record = makeMockRecord();
      const result = encodeGepxBundle({ records: [record] });
      expect(result.payload.assets).toHaveLength(1);
      expect(result.payload.assets[0].asset_id).toBe('gene-test-001');
      expect(result.payload.bundle_type).toBe('Gene');
    });

    it('should include checksum in metadata', () => {
      const record = makeMockRecord();
      const result = encodeGepxBundle({ records: [record] });
      expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
      expect(result.payload.metadata.checksum).toBe(result.checksum);
    });

    it('should support uncompressed output when compress=false', () => {
      const result = encodeGepxBundle({ records: [makeMockRecord()], compress: false });
      expect(result.data[5] & 0x01).toBe(0); // gzip flag unset
    });

    it('should include lineage records when provided', () => {
      const lineage = [
        { parent_id: 'parent-1', child_id: 'child-1', relation: 'evolved_from' as const, published_at: new Date().toISOString() },
      ];
      const result = encodeGepxBundle({ records: [makeMockRecord()], lineage });
      expect(result.payload.lineage).toHaveLength(1);
      expect(result.payload.lineage![0].parent_id).toBe('parent-1');
    });
  });

  describe('encodeSingleAsset', () => {
    it('should encode a single Gene asset', () => {
      const record = makeMockRecord('Gene');
      const result = encodeSingleAsset({
        assetId: 'gene-test-001',
        asset: record.asset as any,
        record,
        compress: false,
      });
      expect(result.payload.assets).toHaveLength(1);
      expect(result.payload.assets[0].gene).toBeDefined();
      expect(result.payload.bundle_type).toBe('Gene');
    });

    it('should encode a single Capsule asset', () => {
      const record = makeMockRecord('Capsule');
      const result = encodeSingleAsset({
        assetId: 'capsule-test-001',
        asset: record.asset as any,
        record,
        compress: false,
      });
      expect(result.payload.assets).toHaveLength(1);
      expect(result.payload.assets[0].capsule).toBeDefined();
      expect(result.payload.bundle_type).toBe('Capsule');
    });
  });
});

describe('GEPX Decoder', () => {
  describe('decodeGepxBuffer', () => {
    it('should decode a round-trip encode/decode correctly', async () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()], compress: false });
      const decoded = await decodeGepxBuffer(original.data);

      expect(decoded.verified).toBe(true);
      expect(decoded.payload.version).toBe(1);
      expect(decoded.payload.assets).toHaveLength(1);
      expect(decoded.payload.assets[0].asset_id).toBe('gene-test-001');
      expect(decoded.checksum).toBe(original.checksum);
    });

    it('should decode gzip-compressed data', async () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()], compress: true });
      const decoded = await decodeGepxBuffer(original.data);

      expect(decoded.verified).toBe(true);
      expect(decoded.payload.assets).toHaveLength(1);
    });

    it('should throw for invalid magic bytes', async () => {
      const invalid = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x01, 0x00, 0x00, 0x00, 0x00, 0x05]);
      await expect(decodeGepxBuffer(invalid)).rejects.toThrow(/Invalid magic/);
    });

    it('should throw for unsupported version', async () => {
      const buf = Buffer.alloc(10);
      GEPX_MAGIC.copy(buf);
      buf[4] = 99; // unsupported version
      buf.writeUInt32BE(0, 6);
      await expect(decodeGepxBuffer(buf)).rejects.toThrow(/Unsupported GEPX version/);
    });

    it('should throw for truncated file', async () => {
      const buf = Buffer.alloc(5);
      GEPX_MAGIC.copy(buf);
      buf[4] = GEPX_VERSION;
      await expect(decodeGepxBuffer(buf)).rejects.toThrow(/too short/);
    });
  });

  describe('validateGepxPayload', () => {
    it('should validate a correct payload', () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()] });
      const validation = validateGepxPayload(original.payload);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject payload with wrong version', () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()] });
      (original.payload as any).version = 99;
      const validation = validateGepxPayload(original.payload);
      expect(validation.valid).toBe(false);
      expect(validation.errors.some((e: string) => e.includes('version'))).toBe(true);
    });

    it('should reject payload with invalid bundle_type', () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()] });
      (original.payload as any).bundle_type = 'InvalidType';
      const validation = validateGepxPayload(original.payload);
      expect(validation.valid).toBe(false);
    });

    it('should warn on missing checksum', () => {
      const original = encodeGepxBundle({ records: [makeMockRecord()] });
      (original.payload.metadata as any).checksum = undefined;
      const validation = validateGepxPayload(original.payload);
      expect(validation.warnings.some((w: string) => w.includes('checksum'))).toBe(true);
    });
  });

  describe('extractAssets', () => {
    it('should correctly separate genes, capsules, and evolution events', () => {
      const geneRecord = makeMockRecord('Gene');
      const capsuleRecord = makeMockRecord('Capsule');
      const original = encodeGepxBundle({ records: [geneRecord, capsuleRecord] });
      const decoded = decodeGepxBuffer(original.data);

      // Note: decodeGepxBuffer returns Promise
      // For sync extract, use original.payload directly
      const extracted = extractAssets(original.payload);

      expect(extracted.genes).toHaveLength(1);
      expect(extracted.capsules).toHaveLength(1);
      expect(extracted.records.size).toBe(2);
    });
  });
});
