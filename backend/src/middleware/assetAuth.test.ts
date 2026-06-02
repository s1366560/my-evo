import { describe, test, expect, beforeEach } from '@jest/globals';
import { registerApiKey, clearApiKeys, registerNodeSecret, clearNodeSecrets, resolveAssetAuth, requireUserId } from './assetAuth.js';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import type { Response, NextFunction } from 'express';

const noopRes: Response = {} as any;
const noopNext: NextFunction = () => {};

describe('assetAuth (3-layer identity)', () => {
  beforeEach(() => {
    clearApiKeys();
    clearNodeSecrets();
  });

  test('resolves session identity from Bearer JWT', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, config.jwtSecret);
    const req: any = { headers: { authorization: `Bearer ${token}` } };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('session');
    expect(req.assetAuth.userId).toBe('u1');
  });

  test('resolves api_key identity from x-api-key header', () => {
    registerApiKey({ userId: 'u2', email: 'n@e.l', role: 'service', key: 'ek_abcdefghijklmnop' });
    const req: any = { headers: { 'x-api-key': 'ek_abcdefghijklmnop' } };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('api_key');
    expect(req.assetAuth.userId).toBe('u2');
    expect(req.assetAuth.apiKeyPrefix).toBe('ek_abcde');
  });

  test('resolves node_secret identity from x-node-id + x-node-secret', () => {
    registerNodeSecret({ nodeId: 'node_abc', secret: 's3cr3t' });
    const req: any = { headers: { 'x-node-id': 'node_abc', 'x-node-secret': 's3cr3t' } };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('node_secret');
    expect(req.assetAuth.nodeId).toBe('node_abc');
  });

  test('falls back to anonymous when nothing matches', () => {
    const req: any = { headers: {} };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('anonymous');
  });

  test('rejects bad api_key (no prefix)', () => {
    const req: any = { headers: { 'x-api-key': 'not_ek_prefix' } };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('anonymous');
  });

  test('rejects bad node_secret', () => {
    registerNodeSecret({ nodeId: 'node_abc', secret: 'correct' });
    const req: any = { headers: { 'x-node-id': 'node_abc', 'x-node-secret': 'wrong' } };
    resolveAssetAuth(req, noopRes, noopNext);
    expect(req.assetAuth.kind).toBe('anonymous');
  });

  test('requireUserId throws on anonymous', () => {
    const req: any = { headers: {}, assetAuth: { kind: 'anonymous' } };
    expect(() => requireUserId(req)).toThrow(/required/i);
  });

  test('requireUserId throws on node_secret (no userId)', () => {
    const req: any = { headers: {}, assetAuth: { kind: 'node_secret', nodeId: 'node_abc' } };
    expect(() => requireUserId(req)).toThrow(/node identity/i);
  });

  test('requireUserId returns userId for session and api_key', () => {
    const s: any = { headers: {}, assetAuth: { kind: 'session', userId: 'u1' } };
    const k: any = { headers: {}, assetAuth: { kind: 'api_key', userId: 'u2' } };
    expect(requireUserId(s)).toBe('u1');
    expect(requireUserId(k)).toBe('u2');
  });
});
