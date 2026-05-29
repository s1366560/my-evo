import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config/index.js';
import { connectDatabase, isMockMode, initMockData } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { mapRouter } from './routes/map.js';
import { graphRouter } from './routes/graph.js';
import { dashboardRouter } from './routes/dashboard.js';
import { aiRouter } from './routes/ai.js';
import { exportRouter } from './routes/export.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app: Express = express();

app.use(helmet());
app.use(cors({
  origin: config.corsOrigin === '*'
    ? true  // Allow any origin (no credentials) or use credentials: false
    : config.corsOrigin,
  credentials: config.corsOrigin !== '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mode: isMockMode() ? 'mock' : 'production',
  });
});

app.use('/api/v1/auth', authRouter);
app.use('/api/v1/map', mapRouter);
app.use('/api/v1/graph', graphRouter);
app.use('/api/v1/ai', aiRouter);
app.use('/api/v1/export', exportRouter);
app.use('/api/v2/dashboard', dashboardRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    if (isMockMode()) {
      await initMockData();
    }
    app.listen(config.port, () => {
      console.log(`🚀 Server running on port ${config.port}`);
      console.log(`   Mode: ${isMockMode() ? 'MOCK (in-memory)' : 'PRODUCTION (PostgreSQL)'}`);
      if (isMockMode()) {
        console.log('   Demo: POST /api/v1/auth/login with {"email":"demo@evo.local","password":"password123"}');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
