export interface Ticket {
  id: string
  title: string
  status: 'NEEDS_HUMAN_REVIEW' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'NEEDS_CODE_REVIEW' | 'DONE'
  requiredCapability?: string
  userStory?: string
  acceptanceCriteria?: string[]
  technicalSpecifications?: string
  batchId?: string
  humanFeedback?: string
  revisionCount?: number
}

export interface PendingBatch {
  id: string
  ticketIds: string[]
  revisionCount: number
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface CodeReviewRequest {
  ticketId: string
  ticketTitle: string
  files: GeneratedFile[]
  deletedFiles?: string[]
}

export interface LogEntry {
  timestamp: string
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  context: string
  message: string
}

export type AgentStatuses = Record<string, string>
