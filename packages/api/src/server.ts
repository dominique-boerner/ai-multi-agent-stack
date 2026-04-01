import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { existsSync } from 'fs';
import { createApiRouter } from './routes';
import dashboardRoutes from './routes/dashboard.route';
import { DashboardService } from './dashboard/dashboard.service';
import { WorkspaceManager } from './orchestrator/workspace-manager';
import { SharedState } from './orchestrator/shared-state';
import { Orchestrator } from './orchestrator/orchestrator';
import { Logger } from './utils/Logger';
import { agentConfig } from './agent-stack.config';


dotenv.config({ path: resolve(process.cwd(), '../../.env') }); // resolve .env from monorepo root

const workspace = new WorkspaceManager(agentConfig);
const state = new SharedState(agentConfig);
const orchestrator = new Orchestrator(agentConfig, state, workspace);

// Hydrate in-memory state from the workspace on disk
workspace.initializeVfs(state);

// Push restored tickets to the dashboard so any freshly connecting SSE client
// receives the full historical ticket set even after a server restart.
DashboardService.syncTickets(state.getAllTickets());

const app = express();
const port = process.env.PORT ?? 3000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  methods: ['GET', 'POST'],
}));
app.use(express.json());

// Initialize SSE dashboard state (agent statuses + heartbeat)
DashboardService.init(agentConfig.agents);

// Mount routes — inject the pre-built dependencies
app.use('/api/v1', createApiRouter(orchestrator, state));
app.use('/dashboard', dashboardRoutes);

// In production: serve the built Vue UI as static files
const __dirname = dirname(fileURLToPath(import.meta.url));
const uiDist = resolve(__dirname, '..', '..', '..', 'ui', 'dist');
if (existsSync(uiDist)) {
  app.use(express.static(uiDist));
  // SPA fallback — return index.html for any unmatched route
  app.get('*', (_req, res) => res.sendFile(join(uiDist, 'index.html')));
  Logger.info('Server', `Serving Vue UI from ${uiDist}`);
}

app.listen(port, () => {
  Logger.info('Server', `AI Multi Agent Stack API running at http://localhost:${port}`);
  Logger.info('Server', `SSE stream at http://localhost:${port}/dashboard/stream`);
});
