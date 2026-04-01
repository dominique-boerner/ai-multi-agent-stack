import { Ticket, ReviewResponse, DeveloperResponse, SystemConfig, BatchInfo } from '../types';
import { RepoMapGenerator } from '../utils/repo-map.generator';
import { Logger } from '../utils/logger';

/**
 * Central in-memory state store for the MAS workflow.
 * All state mutations go through typed accessor methods — the internal
 * Maps are private to prevent uncontrolled external mutation.
 */
export class SharedState {
  private readonly tickets       = new Map<string, Ticket>();
  private readonly proposedCode  = new Map<string, DeveloperResponse>();
  private readonly reviewHistory = new Map<string, ReviewResponse[]>();
  private readonly reviewRetries = new Map<string, number>();
  private readonly activeBatches = new Map<string, BatchInfo>();
  private readonly repoMapGenerator = new RepoMapGenerator();

  /** Virtual file system — mirrors what is (or will be) on disk. */
  public globalVfs = new Map<string, string>();

  constructor(private readonly config: SystemConfig) {}

  public addTicket(ticket: Ticket): void {
    this.tickets.set(ticket.id, ticket);
  }

  public getTicket(ticketId: string): Ticket | undefined {
    return this.tickets.get(ticketId);
  }

  public getAllTickets(): Ticket[] {
    return Array.from(this.tickets.values());
  }

  public updateTicketStatus(ticketId: string, status: Ticket['status']): void {
    const t = this.tickets.get(ticketId);
    if (t) t.status = status;
  }

  /**
   * Computes the next available ticket ID by scanning both the VFS
   * (for persisted tickets) and in-memory tickets.
   */
  public getNextTicketId(): string {
    let maxId = 0;
    for (const key of this.globalVfs.keys()) {
      if (key.startsWith('.ai-stack/tickets/')) {
        const match = key.match(/TKT-(\d+)\.md/);
        if (match) maxId = Math.max(maxId, parseInt(match[1], 10));
      }
    }
    for (const key of this.tickets.keys()) {
      const match = key.match(/TKT-(\d+)/);
      if (match) maxId = Math.max(maxId, parseInt(match[1], 10));
    }
    return `TKT-${maxId + 1}`;
  }

  public createBatch(info: Omit<BatchInfo, 'status' | 'revisionCount'>): BatchInfo {
    const batch: BatchInfo = { ...info, status: 'PENDING', revisionCount: 0 };
    this.activeBatches.set(batch.id, batch);
    return batch;
  }

  public getBatch(batchId: string): BatchInfo | undefined {
    return this.activeBatches.get(batchId);
  }

  public updateBatchStatus(batchId: string, status: BatchInfo['status']): void {
    const b = this.activeBatches.get(batchId);
    if (b) b.status = status;
  }

  /** Returns the first batch still waiting for human review, or undefined. */
  public getPendingBatch(): BatchInfo | undefined {
    for (const b of this.activeBatches.values()) {
      if (b.status === 'PENDING') return b;
    }
    return undefined;
  }

  public updateProposedCode(ticketId: string, response: DeveloperResponse): void {
    this.proposedCode.set(ticketId, response);
  }

  public getProposedCode(ticketId: string): DeveloperResponse | undefined {
    return this.proposedCode.get(ticketId);
  }

  /** Copies approved code from proposedCode into the VFS (and removes deleted files). */
  public commitToVfs(ticketId: string): void {
    const proposal = this.proposedCode.get(ticketId);
    if (!proposal) return;
    for (const file of proposal.files) {
      this.globalVfs.set(file.path, file.content);
    }
    for (const deleted of proposal.deletedFiles ?? []) {
      this.globalVfs.delete(deleted);
    }
  }

  public addReview(ticketId: string, review: ReviewResponse): void {
    const history = this.reviewHistory.get(ticketId) ?? [];
    history.push(review);
    this.reviewHistory.set(ticketId, history);
  }

  public getReviewHistory(ticketId: string): ReviewResponse[] {
    return this.reviewHistory.get(ticketId) ?? [];
  }

  public incrementRetry(ticketId: string): number {
    const next = (this.reviewRetries.get(ticketId) ?? 0) + 1;
    this.reviewRetries.set(ticketId, next);
    return next;
  }

  public getRetryCount(ticketId: string): number {
    return this.reviewRetries.get(ticketId) ?? 0;
  }

  public async getRepoMap(): Promise<string> {
    if (this.globalVfs.size === 0) return 'No files created yet.';
    const map = await this.repoMapGenerator.generateMap(this.globalVfs);
    Logger.debug('SharedState', `Repository Map generated (length: ${map.length})`);
    return map;
  }
}
