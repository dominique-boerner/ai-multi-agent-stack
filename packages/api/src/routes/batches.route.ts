import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator/orchestrator';
import { SharedState } from '../orchestrator/shared-state';
import { Logger } from '../utils/logger';

/**
 * POST /api/v1/batches/:batchId/review
 * Allows a human to approve or reject a PO-generated ticket batch.
 *
 * Body: { action: 'approve' | 'reject', feedback?: string }
 * Note: feedback is required when action === 'reject'.
 */
export function createBatchesRouter(orchestrator: Orchestrator, state: SharedState): Router {
  const router = Router();

  router.post('/batches/:batchId/review', async (req: Request, res: Response): Promise<void> => {
    const { batchId } = req.params;
    const { action, feedback } = req.body as { action: string; feedback?: string };

    if (!isValidReviewAction(action)) {
      res.status(400).json({ error: 'action must be "approve" or "reject".' });
      return;
    }

    const batch = state.getBatch(batchId);
    if (!batch) {
      res.status(404).json({ error: `Batch ${batchId} not found.` });
      return;
    }
    if (batch.status !== 'PENDING') {
      res.status(409).json({ error: `Batch ${batchId} is not pending review (current status: ${batch.status}).` });
      return;
    }

    if (action === 'approve') {
      Logger.info('API', `Human approved batch ${batchId}.`);
      orchestrator.getEventBus().emit('BATCH_APPROVED', batchId);
    } else {
      if (!feedback?.trim()) {
        res.status(400).json({ error: 'feedback is required when rejecting a batch.' });
        return;
      }
      Logger.info('API', `Human rejected batch ${batchId}.`);
      orchestrator.getEventBus().emit('BATCH_REJECTED', { batchId, feedback });
    }

    res.status(202).json({ message: `Batch ${batchId} ${action}d.`, batchId });
  });

  return router;
}

function isValidReviewAction(value: string): value is 'approve' | 'reject' {
  return value === 'approve' || value === 'reject';
}
