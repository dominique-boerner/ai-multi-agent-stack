<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { Ticket } from '../types/dashboard'

const props = defineProps<{ ticket: Ticket }>()
const emit = defineEmits<{ close: [] }>()

const statusConfig: Record<string, { label: string; class: string }> = {
  OPEN:        { label: 'Open',        class: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  IN_PROGRESS: { label: 'In Progress', class: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30' },
  IN_REVIEW:   { label: 'In Review',   class: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  DONE:        { label: 'Done',        class: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
    @click="emit('close')"
  />

  <!-- Sidebar panel -->
  <aside class="fixed inset-y-0 right-0 z-50 w-[440px] max-w-full flex flex-col bg-zinc-900 border-l border-zinc-800 shadow-2xl shadow-black/60">

    <!-- Header -->
    <div class="flex items-start justify-between gap-4 px-6 py-5 border-b border-zinc-800 shrink-0">
      <div class="flex flex-col gap-1.5 min-w-0">
        <p class="font-mono text-[11px] font-bold text-zinc-500 tracking-widest">{{ ticket.id }}</p>
        <h2 class="text-base font-semibold text-zinc-100 leading-snug break-words">{{ ticket.title }}</h2>
        <span
          class="self-start mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold border"
          :class="statusConfig[ticket.status]?.class ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'"
        >
          {{ statusConfig[ticket.status]?.label ?? ticket.status }}
        </span>
      </div>
      <!-- Close -->
      <button
        class="shrink-0 mt-0.5 text-zinc-500 hover:text-zinc-200 transition-colors"
        @click="emit('close')"
        aria-label="Close"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Scrollable body -->
    <div class="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-7">

      <!-- Reviewer feedback from previous rejection (if any) -->
      <section v-if="ticket.humanFeedback">
        <h3 class="section-title" style="color: rgb(251 146 60)">Human Review Feedback</h3>
        <p class="text-sm text-amber-300/80 leading-relaxed bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-3">
          {{ ticket.humanFeedback }}
        </p>
      </section>

      <!-- User Story -->
      <section v-if="ticket.userStory">
        <h3 class="section-title">User Story</h3>
        <p class="text-sm text-zinc-300 leading-relaxed">{{ ticket.userStory }}</p>
      </section>

      <!-- Acceptance Criteria -->
      <section v-if="ticket.acceptanceCriteria?.length">
        <h3 class="section-title">Acceptance Criteria</h3>
        <ul class="flex flex-col gap-2">
          <li
            v-for="(ac, i) in ticket.acceptanceCriteria"
            :key="i"
            class="flex items-start gap-2.5 text-sm text-zinc-300"
          >
            <span class="mt-0.5 w-4 h-4 shrink-0 rounded border border-zinc-600 flex items-center justify-center">
              <svg
                v-if="ticket.status === 'DONE'"
                class="w-2.5 h-2.5 text-emerald-400"
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
            <span class="leading-snug">{{ ac }}</span>
          </li>
        </ul>
      </section>

      <!-- Technical Specifications -->
      <section v-if="ticket.technicalSpecifications">
        <h3 class="section-title">Technical Specifications</h3>
        <p class="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap font-mono bg-zinc-950/60 rounded-lg px-4 py-3 border border-zinc-800">{{ ticket.technicalSpecifications }}</p>
      </section>

    </div>
  </aside>
</template>

<style scoped>
.section-title {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: rgb(113 113 122); /* zinc-500 */
  margin-bottom: 10px;
}
</style>
