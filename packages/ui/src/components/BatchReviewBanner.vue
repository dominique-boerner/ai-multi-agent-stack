<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PendingBatch, Ticket } from '../types/dashboard'

const props = defineProps<{
  batch: PendingBatch
  tickets: Ticket[]
}>()

const emit = defineEmits<{
  approved: []
  rejected: []
}>()

const feedback = ref('')
const status = ref<'idle' | 'loading' | 'error'>('idle')
const errorMsg = ref('')

const batchTickets = computed(() =>
  props.tickets.filter(t => props.batch.ticketIds.includes(t.id))
)

async function submit(action: 'approve' | 'reject') {
  if (action === 'reject' && !feedback.value.trim()) return

  status.value = 'loading'
  errorMsg.value = ''

  try {
    const body: Record<string, string> = { action }
    if (action === 'reject') body.feedback = feedback.value.trim()

    const res = await fetch(`/api/v1/batches/${props.batch.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }

    status.value = 'idle'
    feedback.value = ''
    emit(action === 'approve' ? 'approved' : 'rejected')
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message ?? 'Unknown error'
  }
}
</script>

<template>
  <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 overflow-hidden">

    <!-- Header -->
    <div class="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border-b border-amber-500/20">
      <!-- Pulsing dot -->
      <span class="relative flex h-2.5 w-2.5 shrink-0">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400" />
      </span>
      <span class="text-[11px] font-bold uppercase tracking-widest text-amber-400">
        Awaiting Human Review
      </span>
      <span class="ml-auto text-[10px] text-amber-500/70 font-medium">
        Batch {{ batch.id.replace('batch-', '#') }}
        <template v-if="batch.revisionCount > 0">
          · Revision {{ batch.revisionCount }}
        </template>
      </span>
    </div>

    <div class="px-5 py-4 flex flex-col gap-4">

      <!-- Ticket list -->
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500 mb-2">
          Tickets in this batch ({{ batchTickets.length }})
        </p>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="t in batchTickets"
            :key="t.id"
            class="inline-flex flex-col gap-0.5 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 max-w-[220px]"
          >
            <span class="font-mono text-[10px] text-zinc-500 font-bold">{{ t.id }}</span>
            <span class="text-xs text-zinc-300 leading-snug truncate">{{ t.title }}</span>
          </span>
        </div>
      </div>

      <!-- Feedback textarea -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
          Feedback
          <span class="text-zinc-600 normal-case font-normal">(required to reject)</span>
        </label>
        <textarea
          v-model="feedback"
          rows="3"
          placeholder="e.g. Tickets are too granular — please consolidate into 2 epics…"
          class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono resize-none focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-colors duration-150"
          :disabled="status === 'loading'"
        />
      </div>

      <!-- Error -->
      <p v-if="errorMsg" class="text-xs text-red-400">❌ {{ errorMsg }}</p>

      <!-- Actions -->
      <div class="flex items-center justify-end gap-3 pt-1">
        <button
          class="px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-150"
          :class="feedback.trim()
            ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
            : 'border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'"
          :disabled="status === 'loading' || !feedback.trim()"
          @click="submit('reject')"
        >
          Reject Batch
        </button>

        <button
          class="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          :disabled="status === 'loading'"
          @click="submit('approve')"
        >
          <span v-if="status === 'loading'">Processing…</span>
          <span v-else>Approve Batch →</span>
        </button>
      </div>

    </div>
  </div>
</template>
