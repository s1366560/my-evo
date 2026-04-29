import type { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { UnauthorizedError, ValidationError, ConflictError } from '../shared/errors';
import {
  OAUTH_STATE_EXPIRY_MS,
  OAUTH_CODE_EXPIRY_MS,
  OAUTH_ACCESS_TOKEN_EXPIRY_MS,
  OAUTH_REFRESH_TOKEN_EXPIRY_MS,
} from '../shared/constants';
import { createUnconfiguredPrismaClient } from '../shared/prisma';

// In-memory stores for OAuth state and codes (in production, use Redis)
const oauthStates = new Map<string, {
  state: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  provider: string;
  scope: string;
  createdAt: number;
}>();

const authCodes = new Map<string, {
  code: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  redirectUri: string;
  provider: string;
  scope: string;
  userId?: string;
  createdAt: number;
}>();

const tempCodes = new Map<string, {
  code: string;
  tempCode: string;
  state: string;
  provider: string;
  createdAt: number;
}>();

let prisma = createUnconfiguredPrismaClient();

export function setPrisma(client: PrismaClient): void {
  prisma = client;
}

function getPrismaClient(prismaClient?: PrismaClient): PrismaClient {
  return prismaClient ?? prisma;
}

function generateSecureToken(length: number): string {
  return crypto.randomBytes(length).toString('base64url').slice(0, length);
}

function generateState(): string {
  return generateSecureToken(32);
}

// ===== OAuth2 Provider Configuration =====
interface OAuthProviderConfig {
  clientId: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
}

const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  github: {
    clientId: process.env.OAUTH_GITHUB_CLIENT_ID ?? '',
    authorizationUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['read:user', 'user:email'],
  },
  google: {
    clientId: process.env.OAUTH_GOOGLE_CLIENT_ID ?? '',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
  },
  discord: {
    clientId: process.env.OAUTH_DISCORD_CLIENT_ID ?? '',
    authorizationUrl: 'https://discord.com/api/oauth2/authorize',
    tokenUrl: 'https://discord.com/api/oauth2/token',
    userInfoUrl: 'https://discord.com/api/users/@me',
    scopes: ['identify', 'email'],
  },
};

// ===== PKCE Helper Functions =====
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string, method: 'S256' | 'plain' = 'S256'): string {
  if (method === 'plain') {
    return verifier;
  }
  // S256 method: base64url(SHA256(verifier))
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

export function verifyCodeChallenge(verifier: string, challenge: string, method: string): boolean {
  const computed = generateCodeChallenge(verifier, method as 'S256' | 'plain');
  // SECURITY FIX: Check length first to prevent timing-safe-equal crash on mismatched lengths
  if (computed.length !== challenge.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(challenge));
  } catch {
    return false;
  }
}

// ===== Build Authorization URL =====
export function buildAuthorizationUrl(
  provider: string,
  redirectUri: string,
  state?: string,
  codeChallenge?: string,
  codeChallengeMethod?: string,
  scope?: string,
): string {
  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new ValidationError(`Unsupported OAuth provider: ${provider}`);
  }

  const authState = state ?? generateState();
  const scopes = scope ?? config.scopes.join(' ');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state: authState,
    response_type: 'code',
  });

  // Add PKCE parameters if provided
  if (codeChallenge) {
    params.set('code_challenge', codeChallenge);
    params.set('code_challenge_method', codeChallengeMethod ?? 'S256');
  }

  // Store state for later verification
  oauthStates.set(authState, {
    state: authState,
    codeChallenge: codeChallenge ?? '',
    codeChallengeMethod: codeChallengeMethod ?? 'S256',
    redirectUri,
    provider,
    scope: scopes,
    createdAt: Date.now(),
  });

  // Clean up expired states
  cleanupExpiredStates();

  return `${config.authorizationUrl}?${params.toString()}`;
}

// ===== Exchange Authorization Code for Tokens =====
export async function exchangeCodeForToken(
  code: string,
  codeVerifier: string,
  redirectUri: string,
  provider: string,
  prismaClient?: PrismaClient,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  user?: { id: string; email: string };
}> {
  const client = getPrismaClient(prismaClient);

  // Verify the auth code exists
  const authCode = authCodes.get(code);
  if (!authCode) {
    throw new UnauthorizedError('Invalid or expired authorization code');
  }

  // Verify code hasn't expired (10 minute expiry)
  if (Date.now() - authCode.createdAt > OAUTH_CODE_EXPIRY_MS) {
    authCodes.delete(code);
    throw new UnauthorizedError('Authorization code expired');
  }

  // Verify redirect URI matches
  if (authCode.redirectUri !== redirectUri) {
    throw new UnauthorizedError('Redirect URI mismatch');
  }

  // Verify provider matches
  if (authCode.provider !== provider) {
    throw new UnauthorizedError('Provider mismatch');
  }

  // Verify PKCE
  if (authCode.codeChallenge) {
    if (!verifyCodeChallenge(codeVerifier, authCode.codeChallenge, authCode.codeChallengeMethod)) {
      throw new UnauthorizedError('Invalid code verifier');
    }
  }

  // Delete the used code
  authCodes.delete(code);

  // Generate tokens
  const accessToken = generateSecureToken(48);
  const refreshToken = generateSecureToken(48);
  const expiresIn = Math.floor(OAUTH_ACCESS_TOKEN_EXPIRY_MS / 1000);

  // Find or create user from OAuth account
  let userId = authCode.userId;
  let user = null;

  if (!userId) {
    throw new UnauthorizedError('Authorization code not linked to user');
  }

  user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // Store refresh token
  await client.userSession.create({
    data: {
      token: refreshToken,
      user_id: userId,
      expires_at: new Date(Date.now() + OAUTH_REFRESH_TOKEN_EXPIRY_MS),
    },
  });

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: expiresIn,
    scope: authCode.scope,
    user: { id: user.id, email: user.email },
  };
}

// ===== Refresh Access Token =====
export async function refreshAccessToken(
  refreshToken: string,
  provider: string,
  prismaClient?: PrismaClient,
): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}> {
  const client = getPrismaClient(prismaClient);

  // Verify refresh token exists and is valid
  const session = await client.userSession.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });

  if (!session) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (new Date(session.expires_at) < new Date()) {
    // Clean up expired session
    await client.userSession.delete({ where: { id: session.id } });
    throw new UnauthorizedError('Refresh token expired');
  }

  // Generate new access token
  const accessToken = generateSecureToken(48);
  const newRefreshToken = generateSecureToken(48);
  const expiresIn = Math.floor(OAUTH_ACCESS_TOKEN_EXPIRY_MS / 1000);

  // Update session with new refresh token (token rotation)
  await client.userSession.update({
    where: { id: session.id },
    data: {
      token: newRefreshToken,
      expires_at: new Date(Date.now() + OAUTH_REFRESH_TOKEN_EXPIRY_MS),
    },
  });

  return {
    access_token: accessToken,
    refresh_token: newRefreshToken,
    expires_in: expiresIn,
    scope: 'read profile email',
  };
}

// ===== Get OAuth User Info =====
export async function getOAuthUserInfo(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<{
  id: string;
  email: string;
  linked_providers: string[];
}> {
  const client = getPrismaClient(prismaClient);

  const user = await client.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });

  if (!user) {
    throw new UnauthorizedError('User not found');
  }

  // In a full implementation, we'd query OAuthAccount table for linked providers
  const linkedProviders: string[] = [];

  return {
    id: user.id,
    email: user.email,
    linked_providers: linkedProviders,
  };
}

// ===== Link OAuth Provider =====
export async function linkOAuthProvider(
  userId: string,
  provider: string,
  code: string,
  codeVerifier: string | undefined,
  redirectUri: string,
  prismaClient?: PrismaClient,
): Promise<{
  linked: boolean;
  provider: string;
  provider_user_id?: string;
}> {
  const client = getPrismaClient(prismaClient);

  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new ValidationError(`Unsupported OAuth provider: ${provider}`);
  }

  // In a full implementation, we'd:
  // 1. Exchange the code with the OAuth provider
  // 2. Get the provider's user ID
  // 3. Store the OAuth account linkage

  // For now, create a mock provider user ID
  const providerUserId = `oauth_${provider}_${generateSecureToken(16)}`;

  // Check if already linked
  const existingLink = await (client as any).oauthAccount?.findFirst({
    where: { user_id: userId, provider },
  });

  if (existingLink) {
    throw new ConflictError(`OAuth provider ${provider} is already linked`);
  }

  return {
    linked: true,
    provider,
    provider_user_id: providerUserId,
  };
}

// ===== Unlink OAuth Provider =====
export async function unlinkOAuthProvider(
  userId: string,
  provider: string,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);

  // In a full implementation, we'd delete from OAuthAccount table
  // await client.oauthAccount.deleteMany({
  //   where: { user_id: userId, provider },
  // });

  return;
}

// ===== List Linked Providers =====
export async function listLinkedProviders(
  userId: string,
  prismaClient?: PrismaClient,
): Promise<Array<{
  provider: string;
  linked_at?: string;
  provider_user_id?: string;
}>> {
  const client = getPrismaClient(prismaClient);

  // In a full implementation, we'd query OAuthAccount table
  // const accounts = await client.oauthAccount.findMany({
  //   where: { user_id: userId },
  // });

  return [];
}

// ===== Revoke OAuth Token =====
export async function revokeOAuthToken(
  userId: string,
  token: string | undefined,
  prismaClient?: PrismaClient,
): Promise<void> {
  const client = getPrismaClient(prismaClient);

  if (token) {
    // Revoke specific token
    await client.userSession.deleteMany({
      where: { token, user_id: userId },
    });
  } else {
    // Revoke all OAuth sessions for user
    await client.userSession.deleteMany({
      where: { user_id: userId },
    });
  }
}

// ===== Create OAuth Callback Code =====
export async function createOAuthCallbackCode(
  provider: string,
  code: string,
  state: string | undefined,
  prismaClient?: PrismaClient,
): Promise<string> {
  const client = getPrismaClient(prismaClient);

  const config = OAUTH_PROVIDERS[provider];
  if (!config) {
    throw new ValidationError(`Unsupported OAuth provider: ${provider}`);
  }

  // In a full implementation, we'd exchange the code with the provider
  // For now, create a temporary code for the frontend

  const tempCode = generateSecureToken(32);
  const authCode = generateSecureToken(32);

  tempCodes.set(tempCode, {
    code: authCode,
    tempCode,
    state: state ?? '',
    provider,
    createdAt: Date.now(),
  });

  // Store auth code for later token exchange
  authCodes.set(authCode, {
    code: authCode,
    codeChallenge: '', // PKCE not used for callback flow
    codeChallengeMethod: 'S256',
    redirectUri: '', // Will be verified at token exchange
    provider,
    scope: config.scopes.join(' '),
    createdAt: Date.now(),
  });

  // Clean up expired temp codes
  cleanupExpiredTempCodes();

  return tempCode;
}

// ===== Create Authorization Code (for internal use) =====
export async function createAuthorizationCode(
  userId: string,
  clientId: string,
  redirectUri: string,
  scope: string,
  codeChallenge: string,
  codeChallengeMethod: string,
  provider: string,
  prismaClient?: PrismaClient,
): Promise<string> {
  const code = generateSecureToken(32);

  authCodes.set(code, {
    code,
    codeChallenge,
    codeChallengeMethod,
    redirectUri,
    provider,
    scope,
    userId,
    createdAt: Date.now(),
  });

  // Clean up expired codes
  cleanupExpiredAuthCodes();

  return code;
}

// ===== Cleanup Functions =====
function cleanupExpiredStates(): void {
  const now = Date.now();
  for (const [key, value] of oauthStates.entries()) {
    if (now - value.createdAt > OAUTH_STATE_EXPIRY_MS) {
      oauthStates.delete(key);
    }
  }
}

function cleanupExpiredAuthCodes(): void {
  const now = Date.now();
  for (const [key, value] of authCodes.entries()) {
    if (now - value.createdAt > OAUTH_CODE_EXPIRY_MS) {
      authCodes.delete(key);
    }
  }
}

function cleanupExpiredTempCodes(): void {
  const now = Date.now();
  for (const [key, value] of tempCodes.entries()) {
    if (now - value.createdAt > OAUTH_CODE_EXPIRY_MS) {
      tempCodes.delete(key);
    }
  }
}

// ===== Token Introspection =====
export async function introspectToken(
  token: string,
  prismaClient?: PrismaClient,
): Promise<{
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
}> {
  const client = getPrismaClient(prismaClient);

  const session = await client.userSession.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!session || new Date(session.expires_at) < new Date()) {
    return { active: false };
  }

  return {
    active: true,
    username: session.user.email,
    scope: 'read profile email',
    token_type: 'Bearer',
    exp: Math.floor(new Date(session.expires_at).getTime() / 1000),
  };
}
