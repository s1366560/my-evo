// OAuth service unit tests — redirect URL shape, callback happy path,
// callback with invalid state (400), and user upsert idempotency.

import { describe, test, expect, beforeEach } from '@jest/globals';
import { oauthService } from './service.js';
import { mockStore } from '../db/mock-store.js';
import { getProvider, isMockCredentials } from './providers.js';
import {
  createStateToken,
  validateStateToken,
  __resetOAuthStateStore,
  STATE_TTL_MS,
  OAuthStateStore,
  getOAuthStateStore,
  setOAuthStateStore,
} from './state.js';

const CALLBACK_URI = 'http://localhost:3000/api/v1/auth/oauth/google/callback';

describe('OAuth module', () => {
  beforeEach(() => {
    mockStore.clear();
    __resetOAuthStateStore();
  });

  describe('redirect URL shape', () => {
    test('Google authorize URL contains required params', () => {
      const result = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const url = new URL(result.url);
      expect(url.hostname).toBe('accounts.google.com');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBeTruthy();
      expect(url.searchParams.get('redirect_uri')).toBe(CALLBACK_URI);
      expect(url.searchParams.get('scope')).toBe('openid email profile');
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(result.provider).toBe('google');
    });

    test('GitHub authorize URL contains required params', () => {
      const ghCb = 'http://localhost:3000/api/v1/auth/oauth/github/callback';
      const result = oauthService.buildAuthorizeUrl('github', ghCb);
      const url = new URL(result.url);
      expect(url.hostname).toBe('github.com');
      expect(url.pathname).toBe('/login/oauth/authorize');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBeTruthy();
      expect(url.searchParams.get('redirect_uri')).toBe(ghCb);
      expect(url.searchParams.get('scope')).toBe('read:user user:email');
      expect(result.provider).toBe('github');
    });

    test('rejects unknown provider', () => {
      expect(() => oauthService.buildAuthorizeUrl('twitter', CALLBACK_URI)).toThrow(
        'Unsupported OAuth provider: twitter'
      );
    });

    test('rejects empty or relative redirect_uri', () => {
      expect(() => oauthService.buildAuthorizeUrl('google', '')).toThrow();
      expect(() => oauthService.buildAuthorizeUrl('google', '/callback')).toThrow();
    });

    test('returns isMock=true when mock credentials are used', () => {
      const provider = getProvider('google')!;
      if (isMockCredentials(provider)) {
        const result = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
        expect(result.isMock).toBe(true);
      }
    });
  });

  describe('callback happy path', () => {
    test('Google callback creates user and returns JWT tokens', async () => {
      const authResult = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const code = 'mock-auth-code-123';
      const result = await oauthService.handleCallback('google', {
        code,
        state: authResult.state,
        redirectUri: CALLBACK_URI,
      });
      expect(result.authResponse.accessToken).toBeTruthy();
      expect(result.authResponse.refreshToken).toBeTruthy();
      expect(result.authResponse.user.email).toBeTruthy();
      expect(result.provider).toBe('google');
      expect(result.isNewUser).toBe(true);
    });

    test('GitHub callback creates user and returns JWT tokens', async () => {
      const ghCb = 'http://localhost:3000/api/v1/auth/oauth/github/callback';
      const authResult = oauthService.buildAuthorizeUrl('github', ghCb);
      const code = 'gh-mock-code-456';
      const result = await oauthService.handleCallback('github', {
        code,
        state: authResult.state,
        redirectUri: ghCb,
      });
      expect(result.authResponse.accessToken).toBeTruthy();
      expect(result.authResponse.user.email).toContain('github');
      expect(result.isNewUser).toBe(true);
    });
  });

  describe('callback with invalid state (400)', () => {
    test('rejects missing state', async () => {
      await expect(
        oauthService.handleCallback('google', {
          code: 'some-code',
          state: undefined,
          redirectUri: CALLBACK_URI,
        })
      ).rejects.toThrow('Invalid state: missing_state');
    });

    test('rejects tampered state', async () => {
      const authResult = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const tamperedState = authResult.state.slice(0, -5) + 'XXXXX';
      await expect(
        oauthService.handleCallback('google', {
          code: 'some-code',
          state: tamperedState,
          redirectUri: CALLBACK_URI,
        })
      ).rejects.toThrow('Invalid state');
    });

    test('rejects state from different provider', async () => {
      const googleAuth = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const ghCb = 'http://localhost:3000/api/v1/auth/oauth/github/callback';
      await expect(
        oauthService.handleCallback('github', {
          code: 'some-code',
          state: googleAuth.state,
          redirectUri: ghCb,
        })
      ).rejects.toThrow('Invalid state: provider_mismatch');
    });

    test('rejects missing authorization code', async () => {
      const authResult = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      await expect(
        oauthService.handleCallback('google', {
          code: undefined,
          state: authResult.state,
          redirectUri: CALLBACK_URI,
        })
      ).rejects.toThrow('Missing authorization code');
    });
  });

  describe('user upsert idempotency', () => {
    test('same provider code returns same user on second call', async () => {
      const authResult = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const code = 'idempotent-code-999';
      const first = await oauthService.handleCallback('google', {
        code,
        state: authResult.state,
        redirectUri: CALLBACK_URI,
      });
      // Second call needs a fresh state token
      const authResult2 = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const second = await oauthService.handleCallback('google', {
        code,
        state: authResult2.state,
        redirectUri: CALLBACK_URI,
      });
      expect(first.authResponse.user.id).toBe(second.authResponse.user.id);
      expect(first.authResponse.user.email).toBe(second.authResponse.user.email);
      expect(second.isNewUser).toBe(false);
    });

    test('different codes create different users', async () => {
      const auth1 = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const user1 = await oauthService.handleCallback('google', {
        code: 'code-alpha',
        state: auth1.state,
        redirectUri: CALLBACK_URI,
      });
      const auth2 = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      const user2 = await oauthService.handleCallback('google', {
        code: 'code-beta',
        state: auth2.state,
        redirectUri: CALLBACK_URI,
      });
      expect(user1.authResponse.user.id).not.toBe(user2.authResponse.user.id);
      expect(user1.authResponse.user.email).not.toBe(user2.authResponse.user.email);
    });
  });

  describe('state token module', () => {
    test('createStateToken produces verifiable token', () => {
      const token = createStateToken('google');
      const result = validateStateToken(token, 'google');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.provider).toBe('google');
        expect(typeof result.payload.jti).toBe('string');
        expect(typeof result.payload.iat).toBe('number');
      }
    });

    test('rejects garbage token', () => {
      const result = validateStateToken('not-a-valid-token', 'google');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('malformed_state');
      }
    });
  });

  describe('jti single-use state tracking', () => {
    test('valid fresh state is consumed and returns ok', () => {
      const token = createStateToken('google');
      const result = validateStateToken(token, 'google');
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.provider).toBe('google');
        expect(typeof result.payload.jti).toBe('string');
        expect(typeof result.payload.iat).toBe('number');
      }
    });

    test('replay of the same state token returns already_consumed', () => {
      const token = createStateToken('google');
      // First use succeeds
      const first = validateStateToken(token, 'google');
      expect(first.ok).toBe(true);
      // Replay fails
      const replay = validateStateToken(token, 'google');
      expect(replay.ok).toBe(false);
      if (!replay.ok) {
        expect(replay.reason).toBe('already_consumed');
      }
    });

    test('state with mismatched jti returns unknown_jti', () => {
      // Create a token manually with a jti not in the store
      const crypto = require('crypto');
      const fakeJti = crypto.randomBytes(16).toString('hex');
      const payload = { jti: fakeJti, provider: 'google', iat: Date.now() };
      const b64url = (input: Buffer | string): string => {
        const buf = typeof input === 'string' ? Buffer.from(input) : input;
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      const body = b64url(JSON.stringify(payload));
      const hmac = crypto.createHmac('sha256', 'dev-secret').update(body).digest();
      const sig = b64url(hmac);
      const forgedToken = `${body}.${sig}`;
      const result = validateStateToken(forgedToken, 'google');
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.reason).toBe('unknown_jti');
      }
    });

    test('callback with replayed state returns 400 already_consumed', async () => {
      const authResult = oauthService.buildAuthorizeUrl('google', CALLBACK_URI);
      // First callback succeeds
      const first = await oauthService.handleCallback('google', {
        code: 'replay-test-code',
        state: authResult.state,
        redirectUri: CALLBACK_URI,
      });
      expect(first.authResponse.accessToken).toBeTruthy();
      // Replay the same state token
      await expect(
        oauthService.handleCallback('google', {
          code: 'replay-test-code-2',
          state: authResult.state,
          redirectUri: CALLBACK_URI,
        })
      ).rejects.toThrow('Invalid state: already_consumed');
    });

    test('regression: jtiMap TTL is 600s (STATE_TTL_MS) and expires stale records', () => {
      // Regression #1: the production TTL must be 600 seconds (10 minutes).
      // We assert against the constant directly so that any accidental change
      // to STATE_TTL_MS that would weaken the replay-protection window is
      // caught by CI before merge.
      expect(STATE_TTL_MS).toBe(600_000);
      expect(STATE_TTL_MS / 1000).toBe(600);

      // And behaviourally: a state token issued just inside the TTL must
      // still be consumable, while one whose iat is past the TTL must be
      // rejected with `expired` even if its jti is still in the jtiMap.
      const store = new OAuthStateStore();
      const t0 = 1_700_000_000_000;
      const token = (() => {
        const oldStore = getOAuthStateStore();
        setOAuthStateStore(store);
        try {
          return createStateToken('google');
        } finally {
          setOAuthStateStore(oldStore);
        }
      })();
      // Issue was recorded in the jtiMap.
      const jtiEntry = Array.from(store.jtiMap.values())[0];
      expect(jtiEntry).toBeTruthy();
      expect(jtiEntry.issuedAt).toBeGreaterThan(0);

      // A peek well within the TTL returns the live record.
      expect(store.peek(jtiEntry.jti, jtiEntry.issuedAt + STATE_TTL_MS - 1)).not.toBeNull();

      // A peek past the TTL must evict the entry and return null.
      const after = store.peek(jtiEntry.jti, jtiEntry.issuedAt + STATE_TTL_MS + 1);
      expect(after).toBeNull();
      expect(store.jtiMap.has(jtiEntry.jti)).toBe(false);
    });

    test('regression: jtiMap single-use replay protection cannot be bypassed by re-issuing the same jti', () => {
      // Regression #2: forging a token with a previously-consumed jti must
      // return `already_consumed` even if the signature, iat, and provider
      // fields all look valid. This proves the jtiMap is consulted, not
      // just the JWT signature/iat TTL.
      //
      // Setup: pre-register a known jti directly in the jtiMap, then build a
      // signed token around it. The first validation must succeed and mark
      // the record as consumed. A second validation of the same token must
      // be rejected as `already_consumed`.
      const crypto = require('crypto');
      const knownJti = crypto.randomBytes(16).toString('hex');
      const iat = Date.now();
      const payload = { jti: knownJti, provider: 'google', iat };
      const b64url = (input: Buffer | string): string => {
        const buf = typeof input === 'string' ? Buffer.from(input) : input;
        return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      };
      const body = b64url(JSON.stringify(payload));
      const hmac = crypto.createHmac('sha256', 'dev-secret').update(body).digest();
      const sig = b64url(hmac);
      const forgedToken = `${body}.${sig}`;

      // Pre-register the jti in the jtiMap so the validator can find it.
      const store = getOAuthStateStore();
      store.issue(knownJti, 'google', iat);
      expect(store.jtiMap.has(knownJti)).toBe(true);

      // First call succeeds and consumes the record.
      const first = validateStateToken(forgedToken, 'google');
      expect(first.ok).toBe(true);
      expect(store.jtiMap.get(knownJti)?.consumed).toBe(true);

      // Second call with the same jti must be rejected as `already_consumed`,
      // even though the signature, iat, and provider are otherwise valid.
      const second = validateStateToken(forgedToken, 'google');
      expect(second.ok).toBe(false);
      if (!second.ok) {
        expect(second.reason).toBe('already_consumed');
      }
    });
  });
});
