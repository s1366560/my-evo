import { buildApp } from './app';
import {
  closeGDIRefreshWorker,
  startGDIRefreshWorker,
} from './worker/gdi-refresh';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`EvoMap Hub running on ${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  if (!process.env.REDIS_URL) {
    const isLocalRuntime = !process.env.NODE_ENV
      || process.env.NODE_ENV === 'development'
      || process.env.NODE_ENV === 'test';

    if (isLocalRuntime) {
      app.log.info('[GDI-Refresh] REDIS_URL not set, using default redis://localhost:6379 in local/test mode');
    } else {
      app.log.warn('[GDI-Refresh] REDIS_URL not set; worker startup will degrade until it is configured');
    }
  }

  void startGDIRefreshWorker({ logger: app.log }).catch((err) => {
    app.log.error({ err }, '[GDI-Refresh] Worker failed to start');
  });

  const gracefulShutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);
    const results = await Promise.allSettled([
      closeGDIRefreshWorker(),
      app.close(),
    ]);
    let exitCode = 0;

    for (const result of results) {
      if (result.status === 'rejected') {
        exitCode = 1;
        app.log.error({ err: result.reason }, 'Shutdown cleanup failed');
      }
    }

    process.exit(exitCode);
  };

  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));
}

main();
