import { Router, Request, Response } from 'express';
import { DashboardService } from '../dashboard/dashboard.service';

const router = Router();

/**
 * GET /dashboard/stream
 * SSE endpoint — pushes live state updates to all connected browser clients.
 * The Vue UI connects here to receive real-time agent/ticket/log events.
 */
router.get('/stream', (_req: Request, res: Response): void => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering if behind a proxy
  res.flushHeaders();

  DashboardService.addSSEClient(res);
});

export default router;
