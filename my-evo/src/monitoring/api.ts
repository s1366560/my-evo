import { Router, Request, Response } from 'express';
import * as monitoring from './index';

const router = Router();

// GET /dashboard/metrics
router.get('/dashboard/metrics', (_req: Request, res: Response) => {
  res.json(monitoring.getDashboardMetrics());
});

// GET /alerts
router.get('/alerts', (req: Request, res: Response) => {
  const { type, limit } = req.query;
  const alerts = type
    ? monitoring.getAlertsByType(type as any)
    : monitoring.getActiveAlerts();
  res.json({ alerts: alerts.slice(0, parseInt(limit as string) || 50), total: alerts.length });
});

// GET /alerts/stats
router.get('/alerts/stats', (_req: Request, res: Response) => {
  res.json(monitoring.getAlertStats());
});

// POST /alerts/:id/acknowledge
router.post('/alerts/:id/acknowledge', (req: Request, res: Response) => {
  const success = monitoring.acknowledgeAlert(req.params.id);
  res.json({ success });
});

// POST /alerts/:id/resolve
router.post('/alerts/:id/resolve', (req: Request, res: Response) => {
  const success = monitoring.resolveAlert(req.params.id);
  res.json({ success });
});

// GET /logs
router.get('/logs', (req: Request, res: Response) => {
  const { type, node_id, since, limit } = req.query;
  const logs = monitoring.getLogs({
    type: type as any,
    node_id: node_id as string,
    since: since ? parseInt(since as string) : undefined,
    limit: limit ? parseInt(limit as string) : 100,
  });
  res.json({ logs, total: logs.length });
});

export default router;
