import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator/orchestrator';
import { SharedState } from '../orchestrator/shared-state';
import { Logger } from '../utils/logger';

/**
 * POST /api/v1/tickets/:ticketId/code-review
 * Allows a human to approve or reject AI-reviewed code before it is written to disk.
 *
 * Body: { action: 'approve' | 'reject', feedback?: string }
 * Note: feedback is required when action === 'reject'.
 */
export function createTicketsRouter(orchestrator: Orchestrator, state: SharedState): Router {
  const router = Router();

  router.post('/tickets/:ticketId/code-review', async (req: Request, res: Response): Promise<void> => {
    const { ticketId } = req.params;
    const { action, feedback } = req.body as { action: string; feedback?: string };

    if (!isValidReviewAction(action)) {
      res.status(400).json({ error: 'action must be "approve" or "reject".' });
      return;
    }

    const ticket = state.getTicket(ticketId);
    if (!ticket) {
      res.status(404).json({ error: `Ticket ${ticketId} not found.` });
      return;
    }
    if (ticket.status !== 'NEEDS_CODE_REVIEW') {
      res.status(409).json({ error: `Ticket ${ticketId} is not awaiting code review (status: ${ticket.status}).` });
      return;
    }

    if (action === 'approve') {
      Logger.info('API', `Human approved code for ${ticketId}.`);
      orchestrator.getEventBus().emit('HUMAN_CODE_REVIEW_APPROVED', ticketId);
    } else {
      if (!feedback?.trim()) {
        res.status(400).json({ error: 'feedback is required when rejecting code.' });
        return;
      }
      Logger.info('API', `Human rejected code for ${ticketId}.`);
      orchestrator.getEventBus().emit('HUMAN_CODE_REVIEW_REJECTED', { ticketId, feedback });
    }

    res.status(202).json({ message: `Code review ${action}d for ${ticketId}.`, ticketId });
  });

  return router;
}

function isValidReviewAction(value: string): value is 'approve' | 'reject' {
  return value === 'approve' || value === 'reject';
}
