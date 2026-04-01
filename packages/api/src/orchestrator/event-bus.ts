import { EventEmitter } from 'events';
import { UserPromptPayload } from '../types';

/**
 * Defines the strict, statically typed events that orchestrate the Multi-Agent System lifecycle.
 */
export interface WorkflowEvents {
  /** Triggered when the user submits a new prompt via the API. */
  'PROJECT_REQUESTED': (payload: UserPromptPayload) => void | Promise<void>;

  // --- Human-in-the-Loop: Ticket Batch Review ---

  /** Triggered when a human approves the PO-generated ticket batch. */
  'BATCH_APPROVED': (batchId: string) => void | Promise<void>;

  /** Triggered when a human rejects the batch and provides revision feedback. */
  'BATCH_REJECTED': (payload: { batchId: string; feedback: string }) => void | Promise<void>;

  // --- Core Dev Workflow ---

  /** Triggered when the Product Owner has finalized the software tickets. */
  'TICKETS_CREATED': (ticketIds: string[]) => void | Promise<void>;

  /** Triggered when a specific ticket is ready to be implemented by a Developer. */
  'TICKET_READY_FOR_DEV': (ticketId: string) => void | Promise<void>;

  /** Triggered when a Developer has generated code and requests a Code Review. */
  'CODE_PROPOSED': (ticketId: string) => void | Promise<void>;

  /** Triggered when the Reviewer rejects code, pinging the Developer for another attempt. */
  'REVIEW_REJECTED': (ticketId: string) => void | Promise<void>;

  // --- Human-in-the-Loop: Code Review ---

  /** Triggered when a human approves the AI-reviewed code for writing to disk. */
  'HUMAN_CODE_REVIEW_APPROVED': (ticketId: string) => void | Promise<void>;

  /** Triggered when a human rejects the code and sends it back to the developer. */
  'HUMAN_CODE_REVIEW_REJECTED': (payload: { ticketId: string; feedback: string }) => void | Promise<void>;

  // --- Completion ---

  /** Triggered when a ticket is fully completed, approved, and merged to the File System. */
  'TICKET_COMPLETED': (ticketId: string) => void | Promise<void>;

  /** Triggered when the queue is entirely empty and the workflow has finished. */
  'WORKFLOW_FINISHED': () => void | Promise<void>;
}

/**
 * A central EventBus acting as the asynchronous backbone of the system.
 * Replaces hardcoded loops with a strongly-typed Pub/Sub model.
 */
export class EventBus extends EventEmitter {
  /**
   * Emits a typed workflow event, triggering all registered listeners.
   */
  public emit<K extends keyof WorkflowEvents>(event: K, ...args: Parameters<WorkflowEvents[K]>): boolean {
    return super.emit(event, ...args);
  }

  /**
   * Subscribes to a specific workflow event.
   */
  public on<K extends keyof WorkflowEvents>(event: K, listener: WorkflowEvents[K]): this {
    return super.on(event, listener);
  }
}
