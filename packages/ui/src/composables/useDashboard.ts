import { ref, onMounted, onUnmounted } from 'vue'
import type { Ticket, LogEntry, AgentStatuses, PendingBatch, CodeReviewRequest } from '../types/dashboard'

const MAX_LOGS = 500

/**
 * Composable that manages the SSE connection to the API and
 * exposes reactive state for agents, tickets, logs, and the pending review batch.
 */
export function useDashboard() {
  const agentStatuses = ref<AgentStatuses>({})
  const tickets = ref<Ticket[]>([])
  const logs = ref<LogEntry[]>([])
  const connected = ref(false)
  const pendingBatch = ref<PendingBatch | null>(null)
  const pendingCodeReview = ref<CodeReviewRequest | null>(null)
  const workflowRunning = ref(false)

  let es: EventSource | null = null

  function connect() {
    es = new EventSource('/dashboard/stream')

    es.onopen = () => {
      connected.value = true
    }

    es.onerror = () => {
      connected.value = false
      // EventSource auto-reconnects — no manual retry needed
    }

    es.onmessage = (event: MessageEvent) => {
      if (!event.data || event.data.startsWith(':')) return
      try {
        handleEvent(JSON.parse(event.data))
      } catch {
        // Ignore malformed JSON
      }
    }
  }

  function handleEvent(data: Record<string, any>) {
    switch (data.type) {
      case 'init':
        agentStatuses.value = data.agentStatuses ?? {}
        tickets.value = data.tickets ?? []
        logs.value = data.logs ?? []
        pendingBatch.value = data.pendingBatch ?? null
        pendingCodeReview.value = data.pendingCodeReview ?? null
        workflowRunning.value = data.workflowRunning ?? false
        break

      case 'workflow_status':
        workflowRunning.value = data.workflowRunning ?? false
        break

      case 'agent_status':
        agentStatuses.value = { ...agentStatuses.value, [data.agentId]: data.status }
        break

      case 'tickets':
        tickets.value = data.tickets ?? []
        break

      case 'batch':
        pendingBatch.value = data.pendingBatch ?? null
        break

      case 'code_review':
        pendingCodeReview.value = data.pendingCodeReview ?? null
        break

      case 'log': {
        const entry = data as LogEntry
        logs.value = [...logs.value, entry]
        if (logs.value.length > MAX_LOGS) logs.value.shift()
        break
      }
    }
  }

  onMounted(connect)
  onUnmounted(() => es?.close())

  return { agentStatuses, tickets, logs, connected, pendingBatch, pendingCodeReview, workflowRunning }
}
