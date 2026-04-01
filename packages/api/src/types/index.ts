export interface ICapability<TPayload, TOutput> {
  name: string;
  description?: string;
  execute: (payload: TPayload) => Promise<TOutput>;
}

export interface BasePayload {
  systemConfig: SystemConfig;
  agentConfig: AgentConfig;
  model: string;
}

export interface PoTaskPayload extends BasePayload {
  userPrompt: string;
  additionalContext?: string;
  repoMapContext: string;
  nextTicketId: string;
  /** Present on revision runs — contains the rejected tickets + human feedback for context */
  rejectedBatchContext?: string;
}

export interface DeveloperTaskPayload extends BasePayload {
  ticket: Ticket;
  reviewHistory: ReviewResponse[];
  fetchFileContent: (path: string) => Promise<string>;
  repoMapContext: string;
}

export interface ReviewerTaskPayload extends BasePayload {
  ticket: Ticket;
  proposal: DeveloperResponse;
  repoMapContext: string;
}

export interface AgentConfig {
  id: string;
  role: 'product_owner' | 'developer' | 'reviewer' | string;
  capabilities: ICapability<any, any>[];
  systemInstruction?: string;
}

export interface OrchestratorConfig {
  provider?: 'google' | 'anthropic' | 'ollama';
  model: string;
  strategy: string;
  maxReviewRetries?: number;
}

export interface SystemConfig {
  orchestrator: OrchestratorConfig;
  agents: AgentConfig[];
  outputDirectory?: string;
  ignorePaths?: string[];
  logLevel?: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
}

export interface UserPromptPayload {
  user_prompt: string;
  additional_context?: string;
}

export interface Ticket {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string[];
  technicalSpecifications: string;
  requiredCapability?: string;
  status: 'NEEDS_HUMAN_REVIEW' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'NEEDS_CODE_REVIEW' | 'DONE';
  /** Batch this ticket belongs to (set by Orchestrator after PO run) */
  batchId: string;
  /** Human reviewer feedback when the batch was rejected */
  humanFeedback?: string;
  /** How many times this batch has been through the revision loop */
  revisionCount?: number;
}

/** Stored in SharedState to track the lifecycle of a PO ticket batch */
export interface BatchInfo {
  id: string;
  ticketIds: string[];
  originalPrompt: string;
  additionalContext?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  revisionCount: number;
}

export interface ReviewResponse {
  status: 'APPROVE' | 'REJECT';
  feedback: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface DeveloperResponse {
  files: GeneratedFile[];
  deletedFiles?: string[];
}

/** Payload broadcast to dashboard when a ticket awaits human code review */
export interface CodeReviewRequest {
  ticketId: string;
  ticketTitle: string;
  files: GeneratedFile[];
  deletedFiles?: string[];
}

export enum DataType {
  STRING = "string",
  NUMBER = "number",
  INTEGER = "integer",
  BOOLEAN = "boolean",
  ARRAY = "array",
  OBJECT = "object",
}

export interface JsonSchemaProperty {
  type: DataType;
  description?: string;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  enum?: string[];
}
