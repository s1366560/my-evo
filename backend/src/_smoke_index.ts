// Smoke-test entrypoint: mounts ONLY auth + oauth routes so the
// auth-smoke.sh end-to-end script can exercise the live /auth/login and
// /auth/oauth/:provider state-token flow without dragging in the
// unrelated assets module compile errors. This file is referenced by
// output/auth-smoke.sh when tsx is available.
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config/index.js';
import { connectDatabase, isMockMode, initMockData } from './db/index.js';
import { authRouter } from './routes/auth.js';
import { oauthRouter } from './oauth/routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

dotenv.config();

const app: Express = express();
app.use(helmet());
app.use(cors({
  origin: config.corsOrigin === '*' ? true : config.corsOrigin,
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
app.use('/api/v1/auth/oauth', oauthRouter);
app.use(notFoundHandler);
app.use(errorHandler);

const startServer = async () => {
  try {
    await connectDatabase();
    if (isMockMode()) {
      await initMockData();
    }
    app.listen(config.port, () => {
      console.log(`SMOKE backend running on port ${config.port} (mode=${isMockMode() ? 'MOCK' : 'PROD'})`);
    });
  } catch (error) {
    console.error('Failed to start smoke server:', error);
    process.exit(1);
  }
};

startServer();
export default app;
