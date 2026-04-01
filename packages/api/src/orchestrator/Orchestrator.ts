import { SharedState } from './shared-state';
import { WorkspaceManager } from './workspace-manager';
import {
  UserPromptPayload, AgentConfig, SystemConfig, Ticket,
  DeveloperResponse, ReviewResponse,
  PoTaskPayload, DeveloperTaskPayload, ReviewerTaskPayload, ICapability,
} from '../types';
import type { PoOutput } from '../agents/product-owner/WriteTicketsCapability';
import { DashboardService } from '../dashboard/dashboard.service';
import { Logger } from '../utils/logger';
import { EventBus, WorkflowEvents } from './event-bus';

/**
 * The central nervous system of the MAS stack.
 * Operates purely on a reactive EventBus model to route payloads between agents.
 */
export class Orchestrator {
  private readonly eventBus: EventBus;
  /** Ticket IDs queued for sequential development dispatch. */
  private pendingTickets: string[] = [];

  constructor(
    private readonly config: SystemConfig,
    private readonly state: SharedState,
    private readonly workspace: WorkspaceManager,
  ) {
    this.eventBus = new EventBus();
    Logger.setLevel(this.config.logLevel);
    this.registerEventListeners();
  }

  /** Exposes the EventBus so external callers (REST routes) can emit workflow events. */
  public getEventBus(): EventBus {
    return this.eventBus;
  }

  // ---------------------------------------------------------------------------
  // Event wiring
  // ---------------------------------------------------------------------------

  /**
   * Registers all event→handler bindings.
   * The `bindEvent` helper wraps every handler in a try/catch so a single
   * failing handler never silently kills the event loop.
   */
  private registerEventListeners(): void {
    this.bindEvent('PROJECT_REQUESTED',            p  => this.handleProjectRequested(p));
    this.bindEvent('BATCH_APPROVED',               id => this.handleBatchApproved(id));
    this.bindEvent('BATCH_REJECTED',               p  => this.handleBatchRejected(p.batchId, p.feedback));
    this.bindEvent('TICKETS_CREATED',              ids => this.handleTicketsCreated(ids));
    this.bindEvent('TICKET_READY_FOR_DEV',         id => this.handleTriggerDeveloper(id));
    this.bindEvent('CODE_PROPOSED',                id => this.handleTriggerReviewer(id));
    this.bindEvent('REVIEW_REJECTED',              id => this.handleReviewRejected(id));
    this.bindEvent('HUMAN_CODE_REVIEW_APPROVED',   id => this.handleHumanCodeReviewApproved(id));
    this.bindEvent('HUMAN_CODE_REVIEW_REJECTED',   p  => this.handleHumanCodeReviewRejected(p.ticketId, p.feedback));
    this.bindEvent('TICKET_COMPLETED',             id => this.handleTicketCompleted(id));
    this.bindEvent('WORKFLOW_FINISHED',            async () => { DashboardService.syncWorkflowStatus(false); });
  }

  /**
   * Wraps an async event handler in a try/catch and logs any errors.
   * This keeps `registerEventListeners` free of boilerplate.
   */
  private bindEvent<K extends keyof WorkflowEvents>(
    event: K,
    handler: (...args: Parameters<WorkflowEvents[K]>) => Promise<void>,
  ): void {
    this.eventBus.on(event, (async (...args: any[]) => {
      try { await (handler as any)(...args); }
      catch (err) { Logger.error('Orchestrator', `Failed to handle ${event}`, err); }
    }) as WorkflowEvents[K]);
  }

  // ---------------------------------------------------------------------------
  // Phase 1 — Product Owner & Batch Review
  // ---------------------------------------------------------------------------

  /**
   * Entry point: Triggers the Product Owner to translate the user prompt into
   * tickets. Tickets are placed in NEEDS_HUMAN_REVIEW and grouped into a batch —
   * the dev phase does NOT start until the batch is approved by a human.
   */
  private async handleProjectRequested(payload: UserPromptPayload): Promise<void> {
    DashboardService.syncWorkflowStatus(true);
    Logger.info('Orchestrator', `Starting Agent Lifecycle for: "${payload.user_prompt.substring(0, 60)}…"`);

    const poOutput = await this.triggerProductOwner(payload);

    const tickets = poOutput.tickets ?? [];
    Logger.info('Orchestrator', `Product Owner generated ${tickets.length} tickets.`);

    // Write project docs to VFS + disk
    this.persistDoc('README.md', poOutput.readmeContent);
    this.persistDoc('REQUIREMENTS.md', poOutput.requirementsContent);

    if (tickets.length === 0) {
      this.eventBus.emit('WORKFLOW_FINISHED');
      return;
    }

    const { batchId, ticketIds } = this.registerTicketBatch(tickets, payload.user_prompt, payload.additional_context);

    this.pushDashboardState();
    Logger.info('Orchestrator', `Batch ${batchId} (${ticketIds.length} tickets) is awaiting human review.`);
  }

  /**
   * Human approved the batch — open all tickets and dispatch to the dev phase.
   */
  private async handleBatchApproved(batchId: string): Promise<void> {
    const batch = this.state.getBatch(batchId);
    if (!batch) {
      Logger.error('Orchestrator', `BATCH_APPROVED received for unknown batch ${batchId}`);
      return;
    }

    this.state.updateBatchStatus(batchId, 'APPROVED');
    Logger.info('Orchestrator', `Batch ${batchId} approved. Dispatching ${batch.ticketIds.length} tickets.`);

    for (const ticketId of batch.ticketIds) {
      this.state.updateTicketStatus(ticketId, 'OPEN');
    }

    this.pushDashboardState({ clearBatch: true });
    this.eventBus.emit('TICKETS_CREATED', batch.ticketIds);
  }

  /**
   * Human rejected the batch — store feedback, check revision limit, re-run PO.
   */
  private async handleBatchRejected(batchId: string, feedback: string): Promise<void> {
    const batch = this.state.getBatch(batchId);
    if (!batch) {
      Logger.error('Orchestrator', `BATCH_REJECTED received for unknown batch ${batchId}`);
      return;
    }

    batch.revisionCount++;
    this.state.updateBatchStatus(batchId, 'REJECTED');

    const maxRevisions = this.config.orchestrator.maxReviewRetries ?? 3;
    if (batch.revisionCount >= maxRevisions) {
      Logger.warn('Orchestrator', `Batch ${batchId} reached max revisions (${maxRevisions}). Escalating.`);
      for (const id of batch.ticketIds) this.state.updateTicketStatus(id, 'DONE');
      this.pushDashboardState({ clearBatch: true });
      return;
    }

    Logger.info('Orchestrator', `Batch rejected (revision ${batch.revisionCount}/${maxRevisions}). Starting PO revision…`);

    // Archive old tickets and build context string for the PO revision prompt
    const rejectedSummary = batch.ticketIds
      .map(id => {
        const t = this.state.getTicket(id);
        if (!t) return '';
        t.humanFeedback = feedback;
        t.revisionCount = batch.revisionCount;
        this.state.updateTicketStatus(id, 'DONE');
        this.workspace.writeTicketToDisk(t);
        return `- [${t.id}] ${t.title}`;
      })
      .filter(Boolean)
      .join('\n');

    const rejectedBatchContext = [
      `Human Review Feedback: ${feedback}`,
      ``,
      `Tickets in the rejected batch:`,
      rejectedSummary,
    ].join('\n');

    DashboardService.syncTickets(this.state.getAllTickets());

    // Re-run PO and register the resulting tickets as a new batch
    const revisedPayload: UserPromptPayload = { user_prompt: batch.originalPrompt, additional_context: batch.additionalContext };
    const poOutput = await this.triggerProductOwner(revisedPayload, rejectedBatchContext);

    const { batchId: newBatchId, ticketIds: newTicketIds } = this.registerTicketBatch(
      poOutput.tickets ?? [],
      batch.originalPrompt,
      batch.additionalContext,
      batch.revisionCount,
    );

    this.pushDashboardState();
    Logger.info('Orchestrator', `PO revision done. New batch ${newBatchId} (${newTicketIds.length} tickets) awaiting review.`);
  }

  // ---------------------------------------------------------------------------
  // Phase 2 — Development & AI Review
  // ---------------------------------------------------------------------------

  /**
   * Seeds the sequential ticket queue and dispatches the first ticket to the dev phase.
   */
  private async handleTicketsCreated(ticketIds: string[]): Promise<void> {
    this.pendingTickets = [...ticketIds];
    const next = this.pendingTickets.shift();
    if (next) this.eventBus.emit('TICKET_READY_FOR_DEV', next);
  }

  /**
   * Resolves the Developer agent for the ticket's required capability,
   * builds the payload, and triggers code generation.
   */
  private async handleTriggerDeveloper(ticketId: string): Promise<void> {
    const ticket = this.requireTicket(ticketId);
    this.state.updateTicketStatus(ticketId, 'IN_PROGRESS');
    DashboardService.syncTickets(this.state.getAllTickets());

    const capability = ticket.requiredCapability ?? 'write_code';
    const agentConfig = this.requireAgentByCapability(capability);

    DashboardService.setAgentStatus(agentConfig.id, `Coding ${ticketId}…`);
    Logger.info('Orchestrator', `Assigning ${ticketId} "${ticket.title}" to ${agentConfig.id}`);

    const cap = agentConfig.capabilities.find(c => c.name === capability) as ICapability<DeveloperTaskPayload, DeveloperResponse>;
    const response = await cap.execute({
      ticket,
      repoMapContext: await this.state.getRepoMap(),
      fetchFileContent: filepath => Promise.resolve(this.workspace.fetchFileContent(filepath)),
      reviewHistory: this.state.getReviewHistory(ticketId),
      agentConfig,
      model: this.config.orchestrator.model,
      systemConfig: this.config,
    });

    DashboardService.setAgentStatus(agentConfig.id, 'IDLE');
    this.state.updateProposedCode(ticketId, response);
    this.eventBus.emit('CODE_PROPOSED', ticketId);
  }

  /**
   * Sends the developer's proposal to the AI reviewer.
   * On APPROVE: gates behind human code review.
   * On REJECT:  re-routes to the developer for another iteration.
   */
  private async handleTriggerReviewer(ticketId: string): Promise<void> {
    const ticket = this.requireTicket(ticketId);
    this.state.updateTicketStatus(ticketId, 'IN_REVIEW');
    DashboardService.syncTickets(this.state.getAllTickets());

    const agentConfig = this.requireAgentByCapability('review_code');
    DashboardService.setAgentStatus(agentConfig.id, `Reviewing ${ticketId}…`);
    Logger.info('Orchestrator', `Sending ${ticketId} "${ticket.title}" to reviewer ${agentConfig.id}`);

    const proposal = this.state.getProposedCode(ticketId);
    if (!proposal) throw new Error(`No proposed code in SharedState for ${ticketId}`);

    const cap = agentConfig.capabilities.find(c => c.name === 'review_code') as ICapability<ReviewerTaskPayload, ReviewResponse>;
    const result = await cap.execute({
      ticket,
      proposal,
      repoMapContext: await this.state.getRepoMap(),
      agentConfig,
      model: this.config.orchestrator.model,
      systemConfig: this.config,
    });

    DashboardService.setAgentStatus(agentConfig.id, 'IDLE');
    this.state.addReview(ticketId, result);

    if (result.status === 'APPROVE') {
      Logger.info('Orchestrator', `${ticketId} AI-approved. Waiting for human code review.`);
      this.state.updateTicketStatus(ticketId, 'NEEDS_CODE_REVIEW');
      this.workspace.writeTicketToDisk(this.requireTicket(ticketId));
      DashboardService.syncTickets(this.state.getAllTickets());
      DashboardService.syncCodeReview({ ticketId, ticketTitle: ticket.title, files: proposal.files, deletedFiles: proposal.deletedFiles });
    } else {
      Logger.info('Orchestrator', `${ticketId} AI-rejected. Feedback: ${result.feedback}`);
      this.eventBus.emit('REVIEW_REJECTED', ticketId);
    }
  }

  /**
   * Retry logic for AI-rejected code. Increments the counter and re-dispatches
   * to the developer, or gracefully fails the ticket if max retries are exhausted.
   */
  private async handleReviewRejected(ticketId: string): Promise<void> {
    const maxRetries   = this.config.orchestrator.maxReviewRetries ?? 3;
    const currentRetry = this.state.incrementRetry(ticketId);

    if (currentRetry >= maxRetries) {
      Logger.warn('Orchestrator', `Max retries (${maxRetries}) reached for ${ticketId}. Advancing queue.`);
      this.eventBus.emit('TICKET_COMPLETED', ticketId);
    } else {
      Logger.info('Orchestrator', `Retrying ${ticketId} (${currentRetry}/${maxRetries})…`);
      this.eventBus.emit('TICKET_READY_FOR_DEV', ticketId);
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 3 — Human Code Review
  // ---------------------------------------------------------------------------

  /**
   * Human approved the code — write to disk, commit to VFS, advance queue.
   */
  private async handleHumanCodeReviewApproved(ticketId: string): Promise<void> {
    const ticket = this.requireTicket(ticketId);
    Logger.info('Orchestrator', `Human approved code for ${ticketId}. Writing to disk.`);

    this.state.updateTicketStatus(ticketId, 'DONE');
    this.workspace.writeTicketToDisk(ticket);

    const proposal = this.state.getProposedCode(ticketId);
    if (proposal) {
      this.state.commitToVfs(ticketId);
      this.workspace.applyCodeChangesToDisk(proposal);
    }

    DashboardService.syncTickets(this.state.getAllTickets());
    DashboardService.syncCodeReview(null);
    this.eventBus.emit('TICKET_COMPLETED', ticketId);
  }

  /**
   * Human rejected the code — inject feedback into the review history
   * and send back to the developer (existing retry limit applies).
   */
  private async handleHumanCodeReviewRejected(ticketId: string, feedback: string): Promise<void> {
    this.requireTicket(ticketId); // assert existence
    Logger.info('Orchestrator', `Human rejected code for ${ticketId}. Feedback: ${feedback}`);

    this.state.addReview(ticketId, { status: 'REJECT', feedback: `[Human Review] ${feedback}` });
    DashboardService.syncCodeReview(null);
    this.eventBus.emit('REVIEW_REJECTED', ticketId);
  }

  /**
   * Advances to the next pending ticket, or finishes the workflow if the queue is empty.
   */
  private async handleTicketCompleted(ticketId: string): Promise<void> {
    Logger.info('Orchestrator', `Ticket ${ticketId} completed.`);
    const next = this.pendingTickets.shift();
    if (next) {
      this.eventBus.emit('TICKET_READY_FOR_DEV', next);
    } else {
      Logger.info('Orchestrator', 'All tickets processed — workflow complete.');
      this.eventBus.emit('WORKFLOW_FINISHED');
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Triggers the Product Owner capability, optionally with a revision context
   * string that instructs the PO to revise a previously rejected batch.
   */
  private async triggerProductOwner(payload: UserPromptPayload, rejectedBatchContext?: string): Promise<PoOutput> {
    const agentConfig = this.requireAgentByCapability('write_tickets');
    const cap = agentConfig.capabilities.find(c => c.name === 'write_tickets') as ICapability<PoTaskPayload, PoOutput>;

    const label = rejectedBatchContext ? 'Revising Tickets…' : 'Writing Tickets…';
    DashboardService.setAgentStatus(agentConfig.id, label);
    Logger.info('Orchestrator', `Triggering Product Owner (${agentConfig.id})${rejectedBatchContext ? ' — revision run' : ''}`);

    const result = await cap.execute({
      userPrompt: payload.user_prompt,
      additionalContext: payload.additional_context,
      repoMapContext: await this.state.getRepoMap(),
      nextTicketId: this.state.getNextTicketId(),
      agentConfig,
      model: this.config.orchestrator.model,
      systemConfig: this.config,
      rejectedBatchContext,
    });

    DashboardService.setAgentStatus(agentConfig.id, 'IDLE');
    return result;
  }

  /**
   * Assigns a batchId to each ticket, persists them to state + VFS + disk,
   * and registers the batch in SharedState.
   */
  private registerTicketBatch(
    tickets: Ticket[],
    originalPrompt: string,
    additionalContext?: string,
    revisionCount = 0,
  ): { batchId: string; ticketIds: string[] } {
    const batchId    = `batch-${Date.now()}`;
    const ticketIds: string[] = [];

    for (const ticket of tickets) {
      ticket.batchId       = batchId;
      ticket.status        = 'NEEDS_HUMAN_REVIEW';
      ticket.revisionCount = revisionCount;

      this.state.addTicket(ticket);
      const md = this.workspace.writeTicketToDisk(ticket);
      this.state.globalVfs.set(`.ai-stack/tickets/${ticket.id}.md`, md);
      ticketIds.push(ticket.id);
    }

    const batch = this.state.createBatch({ id: batchId, ticketIds, originalPrompt, additionalContext });
    if (revisionCount > 0) batch.revisionCount = revisionCount;

    return { batchId, ticketIds };
  }

  /** Writes a project document (README, REQUIREMENTS) to VFS and disk. */
  private persistDoc(relativePath: string, content: string): void {
    this.workspace.applyCodeChangesToDisk({ files: [{ path: relativePath, content }] });
    this.state.globalVfs.set(relativePath, content);
  }

  /**
   * Pushes the current ticket list (and optionally clears the pending batch)
   * to the dashboard in a single call.
   */
  private pushDashboardState(opts: { clearBatch?: boolean } = {}): void {
    DashboardService.syncTickets(this.state.getAllTickets());
    DashboardService.syncBatch(opts.clearBatch ? null : (this.state.getPendingBatch() ?? null));
  }

  /** Returns the ticket or throws a descriptive error. */
  private requireTicket(ticketId: string): Ticket {
    const ticket = this.state.getTicket(ticketId);
    if (!ticket) throw new Error(`Ticket "${ticketId}" not found in SharedState.`);
    return ticket;
  }

  /** Returns the first agent config that has the given capability, or throws. */
  private requireAgentByCapability(capabilityName: string): AgentConfig {
    const agent = this.config.agents.find(a => a.capabilities.some(c => c.name === capabilityName));
    if (!agent) throw new Error(`No agent is configured with capability "${capabilityName}".`);
    return agent;
  }
}
