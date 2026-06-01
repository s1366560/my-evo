// OAuth provider configurations for Google and GitHub.
// Env vars: OAUTH_GOOGLE_CLIENT_ID / OAUTH_GOOGLE_CLIENT_SECRET,
//           OAUTH_GITHUB_CLIENT_ID / OAUTH_GITHUB_CLIENT_SECRET.
// When env vars are missing (sandbox runs) the module falls back to mock
// credentials so redirect URLs and provider metadata remain deterministic.

export type ProviderName = 'google' | 'github';

export interface OAuthProviderConfig {
  name: ProviderName;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  /** Build the provider-specific userinfo → normalised profile mapper. */
  normalizeProfile: (raw: any) => NormalizedProfile;
}

export interface NormalizedProfile {
  provider: ProviderName;
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  avatarUrl: string | null;
}

const MOCK_GOOGLE_ID = 'mock-google-client-id';
const MOCK_GOOGLE_SECRET = 'mock-google-client-secret';
const MOCK_GITHUB_ID = 'mock-github-client-id';
const MOCK_GITHUB_SECRET = 'mock-github-client-secret';

const googleConfig: OAuthProviderConfig = {
  name: 'google',
  clientId: process.env.OAUTH_GOOGLE_CLIENT_ID || MOCK_GOOGLE_ID,
  clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET || MOCK_GOOGLE_SECRET,
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo',
  scope: 'openid email profile',
  normalizeProfile: (raw: any): NormalizedProfile => ({
    provider: 'google',
    providerAccountId: String(raw.sub || raw.id || ''),
    email: raw.email ?? null,
    emailVerified: Boolean(raw.email_verified),
    name: raw.name ?? null,
    avatarUrl: raw.picture ?? null,
  }),
};

const githubConfig: OAuthProviderConfig = {
  name: 'github',
  clientId: process.env.OAUTH_GITHUB_CLIENT_ID || MOCK_GITHUB_ID,
  clientSecret: process.env.OAUTH_GITHUB_CLIENT_SECRET || MOCK_GITHUB_SECRET,
  authorizeUrl: 'https://github.com/login/oauth/authorize',
  tokenUrl: 'https://github.com/login/oauth/access_token',
  userInfoUrl: 'https://api.github.com/user',
  scope: 'read:user user:email',
  normalizeProfile: (raw: any): NormalizedProfile => ({
    provider: 'github',
    providerAccountId: String(raw.id || ''),
    email: raw.email ?? null,
    emailVerified: raw.email ? true : false,
    name: raw.name ?? raw.login ?? null,
    avatarUrl: raw.avatar_url ?? null,
  }),
};

const PROVIDERS: Record<ProviderName, OAuthProviderConfig> = {
  google: googleConfig,
  github: githubConfig,
};

export function getProvider(name: string): OAuthProviderConfig | null {
  if (name === 'google') return googleConfig;
  if (name === 'github') return githubConfig;
  return null;
}

export function listProviders(): ProviderName[] {
  return ['google', 'github'];
}

export function isMockCredentials(provider: OAuthProviderConfig): boolean {
  if (provider.name === 'google') {
    return provider.clientId === MOCK_GOOGLE_ID;
  }
  return provider.clientId === MOCK_GITHUB_ID;
}

export { PROVIDERS };
