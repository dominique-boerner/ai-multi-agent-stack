import { Router } from 'express';
import { Orchestrator } from '../orchestrator/orchestrator';
import { SharedState } from '../orchestrator/shared-state';
import { createProjectsRouter } from './projects.route';
import { createBatchesRouter } from './batches.route';
import { createTicketsRouter } from './tickets.route';

/**
 * Root API router factory.
 * Composes all domain routers and injects shared dependencies.
 * Mounted under /api/v1 in server.ts.
 */
export function createApiRouter(orchestrator: Orchestrator, state: SharedState): Router {
  const router = Router();

  router.use('/', createProjectsRouter(orchestrator));
  router.use('/', createBatchesRouter(orchestrator, state));
  router.use('/', createTicketsRouter(orchestrator, state));

  return router;
}
