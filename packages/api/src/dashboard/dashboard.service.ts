import { Response } from 'express';
import { Ticket, AgentConfig, BatchInfo, CodeReviewRequest } from '../types';

export interface LogEntry {
  timestamp: string;
  level: string;
  context: string;
  message: string;
}

/**
 * Singleton service that manages the live web dashboard state.
 * Holds agent statuses, ticket state, and log history.
 * Broadcasts updates to all connected SSE clients in real-time.
 */
export class DashboardService {
  private static clients: Response[] = [];
  private static agentStatuses: Map<string, string> = new Map();
  private static tickets: Ticket[] = [];
  private static logs: LogEntry[] = [];
  private static readonly MAX_LOGS = 500;
  private static pendingBatch: BatchInfo | null = null;
  private static pendingCodeReview: CodeReviewRequest | null = null;
  private static workflowRunning = false;

  /**
   * Initializes agent statuses from config and starts the SSE heartbeat.
   */
  public static init(agents: AgentConfig[]): void {
    agents.forEach(a => this.agentStatuses.set(a.id, 'IDLE'));
    // Keep SSE connections alive with a periodic ping
    setInterval(() => this.heartbeat(), 15000);
  }

  /**
   * Registers a new SSE client and immediately sends the full current state.
   */
  public static addSSEClient(res: Response): void {
    this.clients.push(res);
    this.sendToClient(res, {
      type: 'init',
      agentStatuses: Object.fromEntries(this.agentStatuses),
      tickets: this.tickets,
      logs: this.logs,
      pendingBatch: this.pendingBatch,
      pendingCodeReview: this.pendingCodeReview,
      workflowRunning: this.workflowRunning,
    });
    res.on('close', () => {
      this.clients = this.clients.filter(c => c !== res);
    });
  }

  /**
   * Updates the status of a single agent and broadcasts the change.
   */
  public static setAgentStatus(agentId: string, status: string): void {
    this.agentStatuses.set(agentId, status);
    this.broadcast({ type: 'agent_status', agentId, status });
  }

  /**
   * Replaces the full ticket list and broadcasts the update.
   */
  public static syncTickets(tickets: Ticket[]): void {
    this.tickets = [...tickets];
    this.broadcast({ type: 'tickets', tickets: this.tickets });
  }

  /**
   * Updates the pending batch state and broadcasts it to all clients.
   * Pass null to signal that no batch is currently pending.
   */
  public static syncBatch(batch: BatchInfo | null): void {
    this.pendingBatch = batch;
    this.broadcast({ type: 'batch', pendingBatch: batch });
  }

  /**
   * Updates the pending code review state and broadcasts it to all clients.
   * Pass null once the human has approved/rejected.
   */
  public static syncCodeReview(review: CodeReviewRequest | null): void {
    this.pendingCodeReview = review;
    this.broadcast({ type: 'code_review', pendingCodeReview: review });
  }

  /**
   * Broadcasts whether a workflow is currently active.
   * When true, the UI will lock the prompt panel to prevent concurrent runs.
   */
  public static syncWorkflowStatus(running: boolean): void {
    this.workflowRunning = running;
    this.broadcast({ type: 'workflow_status', workflowRunning: running });
  }

  /**
   * Appends a log entry to the history and broadcasts it to all clients.
   * Called by Logger.ts for every log message.
   */
  public static addLog(level: string, context: string, message: string): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message,
    };
    this.logs.push(entry);
    if (this.logs.length > this.MAX_LOGS) this.logs.shift();
    this.broadcast({ type: 'log', ...entry });
  }

  // --- Private helpers ---

  private static broadcast(data: object): void {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    this.clients = this.clients.filter(client => {
      try {
        client.write(payload);
        return true;
      } catch {
        return false; // Remove dead connections
      }
    });
  }

  private static sendToClient(res: Response, data: object): void {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { /* client disconnected before state could be sent */ }
  }

  private static heartbeat(): void {
    this.clients = this.clients.filter(client => {
      try {
        client.write(': ping\n\n');
        return true;
      } catch {
        return false;
      }
    });
  }
}
