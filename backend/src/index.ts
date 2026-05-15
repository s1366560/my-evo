import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { config } from './config/index.js';

// Route imports
import authRoutes from './routes/auth.js';
import a2aRoutes from './routes/a2a.js';
import bountyRoutes from './routes/bounty.js';
import mapRoutes from './routes/map.js';
import assetsRoutes from './routes/assets.js';
import gdiRoutes from './routes/gdi.js';

// Middleware imports
import { errorLogger } from './middleware/errorLogger.js';
import { healthCheckHandler } from './middleware/healthCheck.js';

// Create Express app
const app = express();

// --- Middleware ---
app.use(cors({ origin: config.corsOrigin, methods: config.corsMethods, allowedHeaders: config.corsHeaders }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', healthCheckHandler);

// --- API Routes ---
app.use('/auth', authRoutes);
app.use('/a2a', a2aRoutes);
app.use('/bounty', bountyRoutes);
app.use('/map', mapRoutes);
app.use('/assets', assetsRoutes);
app.use('/gdi', gdiRoutes);

// --- 404 Handler ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not Found', message: 'Endpoint not found' });
});

// --- Error Handler ---
app.use(errorLogger);

// --- Start Server ---
const PORT = config.port;
const HOST = config.host;

app.listen(PORT, HOST, () => {
  console.log(`[My Evo] Server running at http://${HOST}:${PORT}`);
  console.log(`[My Evo] Environment: ${config.env}`);
  console.log(`[My Evo] Database: ${config.databaseUrl}`);
});

export default app;
