import { z } from 'zod';

// ----- Schema -----
export const configSchema = z.object({
  // Server
  port: z.coerce.number().int().min(1).max(65535).default(3001),
  host: z.string().default('0.0.0.0'),
  baseUrl: z.string().default('http://localhost:3001'),
  logLevel: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  // Database — individual params (preferred) OR full DATABASE_URL
  postgresHost: z.string().default('localhost'),
  postgresPort: z.coerce.number().int().min(1).max(65535).default(5432),
  postgresDb: z.string().default('evomap'),
  postgresUser: z.string().default('postgres'),
  postgresPassword: z.string().default(''),
  databaseUrl: z.string().default(''), // full URL fallback

  // Redis
  redisUrl: z.string().url().default('redis://localhost:6379'),

  // OpenAI
  openaiApiKey: z.string().default(''),

  // Neo4j
  neo4jUri: z.string().default('bolt://localhost:7687'),
  neo4jUser: z.string().default('neo4j'),
  neo4jPassword: z.string().default(''),

  // S3
  s3Endpoint: z.string().default(''),
  s3Region: z.string().default('us-east-1'),
  s3AccessKey: z.string().default(''),
  s3SecretKey: z.string().default(''),
  s3Bucket: z.string().default('evomap-assets'),
  s3PublicUrl: z.string().default(''),

  // Security
  nodeSecret: z.string().default(''),
  sessionSecret: z.string().default(''),

  // Rate limiting
  rateLimitMax: z.coerce.number().int().min(1).default(100),
  rateLimitWindowMs: z.coerce.number().int().min(1000).default(60000),

  // Feature flags
  featureNeo4jEnabled: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
  featureS3Enabled: z
    .string()
    .transform((v) => v === 'true')
    .default('false'),
});

export type Config = z.infer<typeof configSchema>;

// ----- Loader -----
function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function required(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function buildDatabaseUrl(raw: Record<string, string>): string {
  // Prefer full DATABASE_URL if provided, otherwise build from individual params
  const url = raw['DATABASE_URL'];
  if (url && url.trim() !== '') return url;

  const host = raw['POSTGRES_HOST'] ?? 'localhost';
  const port = raw['POSTGRES_PORT'] ?? '5432';
  const db = raw['POSTGRES_DB'] ?? 'evomap';
  const user = raw['POSTGRES_USER'] ?? 'postgres';
  const password = raw['POSTGRES_PASSWORD'] ?? '';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${encodeURIComponent(db)}`;
}

function load(): Config {
  const raw: Record<string, string> = {
    port: env('PORT', '3000'),
    host: env('HOST', '0.0.0.0'),
    logLevel: env('LOG_LEVEL', 'info'),
    baseUrl: env('BASE_URL', 'http://localhost:3001'),
    databaseUrl: buildDatabaseUrl({
      DATABASE_URL: process.env['DATABASE_URL'] ?? '',
      POSTGRES_HOST: env('POSTGRES_HOST', 'localhost'),
      POSTGRES_PORT: env('POSTGRES_PORT', '5432'),
      POSTGRES_DB: env('POSTGRES_DB', 'evomap'),
      POSTGRES_USER: env('POSTGRES_USER', 'postgres'),
      POSTGRES_PASSWORD: env('POSTGRES_PASSWORD', ''),
    }),
    postgresHost: env('POSTGRES_HOST', 'localhost'),
    postgresPort: String(env('POSTGRES_PORT', '5432')),
    postgresDb: env('POSTGRES_DB', 'evomap'),
    postgresUser: env('POSTGRES_USER', 'postgres'),
    postgresPassword: env('POSTGRES_PASSWORD', ''),
    redisUrl: env('REDIS_URL', 'redis://localhost:6379'),
    openaiApiKey: env('OPENAI_API_KEY', ''),
    neo4jUri: env('NEO4J_URI', 'bolt://localhost:7687'),
    neo4jUser: env('NEO4J_USER', 'neo4j'),
    neo4jPassword: env('NEO4J_PASSWORD', ''),
    s3Endpoint: env('S3_ENDPOINT', ''),
    s3Region: env('S3_REGION', 'us-east-1'),
    s3AccessKey: env('S3_ACCESS_KEY', ''),
    s3SecretKey: env('S3_SECRET_KEY', ''),
    s3Bucket: env('S3_BUCKET', 'evomap-assets'),
    s3PublicUrl: env('S3_PUBLIC_URL', ''),
    nodeSecret: env('NODE_SECRET', ''),
    sessionSecret: env('SESSION_SECRET', ''),
    rateLimitMax: env('RATE_LIMIT_MAX', '100'),
    rateLimitWindowMs: env('RATE_LIMIT_WINDOW_MS', '60000'),
    featureNeo4jEnabled: env('FEATURE_NEO4J_ENABLED', 'false'),
    featureS3Enabled: env('FEATURE_S3_ENABLED', 'false'),
  };

  return configSchema.parse(raw);
}

// Singleton — parsed once at startup
let _cached: Config | undefined;

export function getConfig(): Config {
  if (!_cached) {
    _cached = load();
  }
  return _cached;
}
