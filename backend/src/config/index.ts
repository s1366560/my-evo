// Application configuration
// All values can be overridden via environment variables

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  env: process.env.NODE_ENV || 'development',

  // CORS
  corsOrigin: process.env.CORS_ORIGIN || '*',
  corsMethods: process.env.CORS_METHODS || 'GET,POST,PUT,DELETE,OPTIONS',
  corsHeaders: process.env.CORS_HEADERS || 'Content-Type,Authorization,x-node-id',

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'my-evo-jwt-secret-change-in-production',
  jwtExpiry: process.env.JWT_EXPIRY || '7d',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',

  // Redis (optional — for caching and pub/sub)
  redisUrl: process.env.REDIS_URL || process.env.REDIS_HOST
    ? `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`
    : undefined,

  // Rate limiting
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),

  // A2A Protocol
  a2a: {
    heartbeatIntervalMs: parseInt(process.env.A2A_HEARTBEAT_INTERVAL_MS || '30000', 10),
    heartbeatTimeoutMs: parseInt(process.env.A2A_HEARTBEAT_TIMEOUT_MS || '120000', 10),
    maxNodesPerUser: parseInt(process.env.A2A_MAX_NODES_PER_USER || '10', 10),
  },

  // GDI Scoring
  gdi: {
    apiKey: process.env.GDI_API_KEY || '',
    apiUrl: process.env.GDI_API_URL || '',
    weights: {
      correctness: parseFloat(process.env.GDI_WEIGHT_CORRECTNESS || '0.30'),
      diversity: parseFloat(process.env.GDI_WEIGHT_DIVERSITY || '0.20'),
      composability: parseFloat(process.env.GDI_WEIGHT_COMPOSABILITY || '0.25'),
      helpfulness: parseFloat(process.env.GDI_WEIGHT_HELPFULNESS || '0.25'),
    },
  },

  // Bounty System
  bounty: {
    maxReward: parseFloat(process.env.BOUNTY_MAX_REWARD || '10000'),
    defaultExpiryDays: parseInt(process.env.BOUNTY_DEFAULT_EXPIRY_DAYS || '30', 10),
    maxExpiryDays: parseInt(process.env.BOUNTY_MAX_EXPIRY_DAYS || '90', 10),
  },
};

export default config;
