import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const config = {
  // Server
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  databaseUrl: process.env.DATABASE_URL || 'file:./dev.db',
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  
  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // GDI Scoring
  gdi: {
    apiKey: process.env.GDI_API_KEY || '',
    apiUrl: process.env.GDI_API_URL || '',
  },
  
  // Paths
  paths: {
    uploads: path.join(__dirname, '../../uploads'),
    exports: path.join(__dirname, '../../exports'),
  },
} as const;

export type Config = typeof config;
