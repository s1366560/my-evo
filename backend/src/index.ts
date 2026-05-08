import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config/index.js';
import { checkDatabaseHealth, disconnectDatabase } from './db/prisma.js';
import {
  requestLogger,
  securityLogger,
  performanceMonitor,
  errorLogger,
} from './middleware/errorLogger.js';
import {
  healthCheckHandler,
  readinessHandler,
  livenessHandler,
} from './middleware/healthCheck.js';

// Import routes
import authRoutes from './routes/auth.js';
import a2aRoutes from './routes/a2a.js';
import bountyRoutes from './routes/bounty.js';
import mapRoutes from './routes/map.js';

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origin,
  credentials: true,
}));

// Parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
  },
});
app.use('/api/', limiter);

// Request logging and monitoring middleware
app.use(requestLogger);
app.use(securityLogger);
app.use(performanceMonitor);

// Health check endpoints
// Basic health check
app.get('/health', healthCheckHandler);

// Deep health check with dependency info
app.get('/health/detailed', healthCheckHandler);

// Kubernetes readiness probe
app.get('/ready', readinessHandler);

// Kubernetes liveness probe
app.get('/live', livenessHandler);

// API Routes
app.use('/auth', authRoutes);
app.use('/a2a', a2aRoutes);
app.use('/bounty', bountyRoutes);
app.use('/map', mapRoutes);

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'My Evo API',
    version: '1.0.0',
    description: 'AI Self-Evolution Infrastructure',
    docs: '/api/docs',
    health: '/health',
    readiness: '/ready',
    liveness: '/live',
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler with error logger
app.use(errorLogger);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await disconnectDatabase();
  process.exit(0);
});

// Start server
const server = app.listen(config.port, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   My Evo Backend API                                     ║
║   ───────────────────                                    ║
║   Server running on http://localhost:${config.port}             ║
║   Environment: ${config.nodeEnv.padEnd(40)}║
║                                                          ║
║   Health Endpoints:                                      ║
║   • GET  /health          - Basic health check          ║
║   • GET  /health/detailed - Deep health check           ║
║   • GET  /ready           - Kubernetes readiness probe   ║
║   • GET  /live            - Kubernetes liveness probe    ║
║                                                          ║
║   API Endpoints:                                         ║
║   • POST /auth/register   - User registration            ║
║   • POST /auth/login      - User login                  ║
║   • GET  /auth/me        - Get current user            ║
║   • POST /a2a/hello      - Node registration           ║
║   • POST /a2a/heartbeat  - Node heartbeat              ║
║   • POST /a2a/publish    - Publish asset               ║
║   • POST /a2a/fetch      - Search assets               ║
║   • POST /bounty/create  - Create bounty                ║
║   • GET  /bounty/list    - List bounties               ║
║   • GET  /map/graph      - Get evolution map           ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);
});

export { app, server };
