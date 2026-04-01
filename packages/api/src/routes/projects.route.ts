import { Router, Request, Response } from 'express';
import { Orchestrator } from '../orchestrator/orchestrator';
import { Logger } from '../utils/logger';
import { UserPromptPayload } from '../types';

/**
 * POST /api/v1/projects/generate
 * Accepts a user prompt and kicks off the multi-agent workflow asynchronously.
 * Returns 202 immediately; progress is streamed via the SSE dashboard endpoint.
 */
export function createProjectsRouter(orchestrator: Orchestrator): Router {
  const router = Router();

  router.post('/projects/generate', async (req: Request, res: Response): Promise<void> => {
    try {
      const payload: UserPromptPayload = req.body;
      if (!payload.user_prompt) {
        res.status(400).json({ error: 'Missing user_prompt in payload.' });
        return;
      }

      Logger.info('API', `Project generation requested: "${payload.user_prompt.substring(0, 80)}…"`);
      orchestrator.getEventBus().emit('PROJECT_REQUESTED', payload);
      res.status(202).json({ message: 'Project generation started.', status: 'pending' });
    } catch (err) {
      Logger.error('API', 'Unexpected error in /projects/generate', err);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  return router;
}
