// ===== OAuth2 Types =====

export type OAuthProvider = 'github' | 'google' | 'discord';

export interface OAuthState {
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
  redirectUri: string;
  provider: OAuthProvider;
  scope: string;
  createdAt: number;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface OAuthUserInfo {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
  provider: OAuthProvider;
}

// ===== OAuth2 Scopes =====
export const OAUTH_SCOPES = {
  READ: 'read',
  PROFILE: 'profile',
  EMAIL: 'email',
  KG_READ: 'kg_read',
  KG_WRITE: 'kg_write',
  ASSETS_READ: 'assets_read',
  ASSETS_WRITE: 'assets_write',
} as const;

export type OAuthScope = typeof OAUTH_SCOPES[keyof typeof OAUTH_SCOPES];

// ===== OAuth2 PKCE Methods =====
export const PKCE_METHODS = {
  S256: 'S256',
  PLAIN: 'plain',
} as const;

export type PKCEMethod = typeof PKCE_METHODS[keyof typeof PKCE_METHODS];

// ===== OAuth2 Grant Types =====
export const GRANT_TYPES = {
  AUTHORIZATION_CODE: 'authorization_code',
  REFRESH_TOKEN: 'refresh_token',
  CLIENT_CREDENTIALS: 'client_credentials',
} as const;

export type GrantType = typeof GRANT_TYPES[keyof typeof GRANT_TYPES];

// ===== OAuth2 Error Codes =====
export const OAUTH_ERRORS = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
  SERVER_ERROR: 'server_error',
  TEMPORARILY_UNAVAILABLE: 'temporarily_unavailable',
} as const;

export type OAuthError = typeof OAUTH_ERRORS[keyof typeof OAUTH_ERRORS];

// ===== Token Types =====
export interface OAuthAccessToken {
  token: string;
  userId: string;
  scope: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface OAuthRefreshToken {
  token: string;
  userId: string;
  accessTokenId: string;
  expiresAt: Date;
  createdAt: Date;
}

// ===== OAuth2 Configuration =====
export interface OAuthConfig {
  providers: {
    [key: string]: {
      clientId: string;
      clientSecret?: string;
      authorizationUrl: string;
      tokenUrl: string;
      userInfoUrl: string;
      scopes: string[];
    };
  };
  tokenExpiry: {
    accessToken: number; // seconds
    refreshToken: number; // seconds
    authCode: number; // seconds
    state: number; // seconds
  };
  security: {
    enforcePKCE: boolean;
    enforceState: boolean;
    allowTokenRotation: boolean;
  };
}

export const DEFAULT_OAUTH_CONFIG: OAuthConfig = {
  providers: {
    github: {
      clientId: '',
      authorizationUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userInfoUrl: 'https://api.github.com/user',
      scopes: ['read:user', 'user:email'],
    },
    google: {
      clientId: '',
      authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      tokenUrl: 'https://oauth2.googleapis.com/token',
      userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
      scopes: ['openid', 'email', 'profile'],
    },
    discord: {
      clientId: '',
      authorizationUrl: 'https://discord.com/api/oauth2/authorize',
      tokenUrl: 'https://discord.com/api/oauth2/token',
      userInfoUrl: 'https://discord.com/api/users/@me',
      scopes: ['identify', 'email'],
    },
  },
  tokenExpiry: {
    accessToken: 3600, // 1 hour
    refreshToken: 2592000, // 30 days
    authCode: 600, // 10 minutes
    state: 600, // 10 minutes
  },
  security: {
    enforcePKCE: true,
    enforceState: true,
    allowTokenRotation: true,
  },
};
