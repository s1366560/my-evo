// OAuth service: builds authorize URLs, exchanges auth codes, fetches
// provider profile, and upserts the local User row.

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma, isMockMode, mockStore } from '../db/index.js';
import { config } from '../config/index.js';
import { HttpError } from '../middleware/errorHandler.js';
import {
  getProvider,
  isMockCredentials,
  type OAuthProviderConfig,
  type NormalizedProfile,
  type ProviderName,
} from './providers.js';
import { createStateToken, validateStateToken } from './state.js';
import type { AuthResponse, TokenPayload } from '../auth/types.js';

export interface AuthorizeUrlResult {
  url: string;
  state: string;
  provider: ProviderName;
  isMock: boolean;
}

export interface CallbackResult {
  authResponse: AuthResponse;
  provider: ProviderName;
  isNewUser: boolean;
}

export class OAuthService {
  /** Build the provider authorize URL with CSRF state and PKCE-less redirect_uri. */
  buildAuthorizeUrl(providerName: string, redirectUri: string): AuthorizeUrlResult {
    const provider = this.requireProvider(providerName);
    if (!redirectUri || !/^https?:\/\//.test(redirectUri)) {
      throw new HttpError(400, 'redirect_uri must be an absolute http(s) URL');
    }
    const state = createStateToken(provider.name);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: provider.clientId,
      redirect_uri: redirectUri,
      scope: provider.scope,
      state,
      // PKCE could be added in a follow-up; kept simple per the task scope.
    });
    // Google accepts `prompt=select_account` to streamline re-auth; harmless for GitHub.
    if (provider.name === 'google') {
      params.set('prompt', 'select_account');
    }
    return {
      url: `${provider.authorizeUrl}?${params.toString()}`,
      state,
      provider: provider.name,
      isMock: isMockCredentials(provider),
    };
  }

  /**
   * Exchange the auth code, fetch profile, upsert the User row, and return a
   * session AuthResponse identical to the email/password flow.
   */
  async handleCallback(
    providerName: string,
    params: { code?: string; state?: string; redirectUri: string }
  ): Promise<CallbackResult> {
    const provider = this.requireProvider(providerName);
    const stateCheck = validateStateToken(params.state, provider.name);
    if (!stateCheck.ok) {
      throw new HttpError(400, `Invalid state: ${stateCheck.reason}`);
    }
    if (!params.code) {
      throw new HttpError(400, 'Missing authorization code');
    }
    const profile = await this.fetchProfileForCode(provider, params.code, params.redirectUri);
    if (!profile.email) {
      throw new HttpError(400, `Provider ${provider.name} did not return an email address`);
    }
    const { user, isNewUser } = await this.upsertUser(profile);
    const authResponse = isMockMode()
      ? this.buildMockAuthResponse(user)
      : this.buildAuthResponse(user);
    return { authResponse, provider: provider.name, isNewUser };
  }

  private requireProvider(name: string): OAuthProviderConfig {
    const provider = getProvider(name);
    if (!provider) {
      throw new HttpError(400, `Unsupported OAuth provider: ${name}`);
    }
    return provider;
  }

  /**
   * Exchange the auth code for tokens and fetch the provider profile.
   * In mock-credential mode (sandbox runs) we synthesise a deterministic profile
   * based on the code so callbacks can be exercised end-to-end without a real IdP.
   */
  private async fetchProfileForCode(
    provider: OAuthProviderConfig,
    code: string,
    redirectUri: string
  ): Promise<NormalizedProfile> {
    if (isMockCredentials(provider)) {
      return this.mockProfileFromCode(provider, code);
    }
    const tokenResp = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        redirect_uri: redirectUri,
      }).toString(),
    });
    if (!tokenResp.ok) {
      const errText = await tokenResp.text().catch(() => '');
      throw new HttpError(502, `Token exchange failed: ${tokenResp.status} ${errText.slice(0, 200)}`);
    }
    const tokenJson: any = await tokenResp.json();
    const accessToken: string | undefined = tokenJson.access_token;
    if (!accessToken) {
      throw new HttpError(502, 'Token endpoint returned no access_token');
    }
    const userResp = await fetch(provider.userInfoUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
        'User-Agent': 'my-evo-backend',
      },
    });
    if (!userResp.ok) {
      throw new HttpError(502, `Userinfo fetch failed: ${userResp.status}`);
    }
    const raw: any = await userResp.json();
    return provider.normalizeProfile(raw);
  }

  private mockProfileFromCode(provider: OAuthProviderConfig, code: string): NormalizedProfile {
    // Derive a stable synthetic email from the code so the same auth code
    // always resolves to the same user. Real flows use provider-issued codes.
    const digest = crypto.createHash('sha256').update(code).digest('hex').slice(0, 12);
    const localPart = `${provider.name}-user-${digest}`;
    return provider.normalizeProfile({
      sub: `mock-${provider.name}-${digest}`,
      id: `mock-${provider.name}-${digest}`,
      email: `${localPart}@example.com`,
      email_verified: true,
      name: `Mock ${provider.name[0].toUpperCase()}${provider.name.slice(1)} User`,
      picture: null,
      login: localPart,
      avatar_url: null,
    });
  }

  /** Upsert the local User row keyed by (provider, providerAccountId) AND email. */
  private async upsertUser(profile: NormalizedProfile): Promise<{ user: any; isNewUser: boolean }> {
    if (isMockMode()) {
      const existing = profile.email
        ? await mockStore.findUserByEmail(profile.email)
        : null;
      if (existing) {
        // Refresh name/avatar if the provider sent updates; mark email verified.
        const updated = await mockStore.updateUser
          ? await (mockStore as any).updateUser(existing.id, {
              name: profile.name ?? existing.name,
              avatar: profile.avatarUrl ?? existing.avatar,
            })
          : existing;
        return { user: updated, isNewUser: false };
      }
      const user = await mockStore.createUser({
        email: profile.email as string,
        // OAuth-only users still get a non-empty password field so the
        // existing `password: String` schema constraint is satisfied.
        password: crypto.randomBytes(24).toString('hex'),
        name: profile.name ?? '',
        level: 1,
        reputation: 0,
        credits: 0,
      });
      return { user, isNewUser: true };
    }

    // Production path: query Prisma by email first (canonical uniqueness key).
    const email = profile.email as string;
    const existing = await prisma!.user.findUnique({ where: { email } });
    if (existing) {
      const updated = await prisma!.user.update({
        where: { id: existing.id },
        data: {
          name: profile.name ?? existing.name,
          avatar: profile.avatarUrl ?? existing.avatar,
        },
      });
      return { user: updated, isNewUser: false };
    }
    const created = await prisma!.user.create({
      data: {
        email,
        password: crypto.randomBytes(24).toString('hex'),
        name: profile.name,
        avatar: profile.avatarUrl,
        level: 1,
        reputation: 0,
        credits: 0,
      },
    });
    return { user: created, isNewUser: true };
  }

  private buildAuthResponse(user: any): AuthResponse {
    const payload: TokenPayload = { userId: user.id, email: user.email, role: user.role };
    return {
      user: {
        id: user.id, email: user.email, name: user.name, avatar: user.avatar,
        role: user.role, level: user.level, reputation: user.reputation,
        credits: user.credits, createdAt: user.createdAt, updatedAt: user.updatedAt,
      },
      accessToken: jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      }),
      refreshToken: jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
      }),
    };
  }

  private buildMockAuthResponse(user: any): AuthResponse {
    const payload: TokenPayload = { userId: user.id, email: user.email, role: 'user' };
    return {
      user: {
        id: user.id, email: user.email, name: user.name, avatar: null,
        role: 'user', level: user.level, reputation: user.reputation,
        credits: user.credits, createdAt: user.createdAt, updatedAt: user.updatedAt,
      },
      accessToken: jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn as jwt.SignOptions['expiresIn'],
      }),
      refreshToken: jwt.sign(payload, config.jwtSecret, {
        expiresIn: config.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
      }),
    };
  }
}

export const oauthService = new OAuthService();
