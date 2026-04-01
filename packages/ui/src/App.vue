<script setup lang="ts">
import { ref } from 'vue'
import AgentGrid from './components/AgentGrid.vue'
import KanbanBoard from './components/KanbanBoard.vue'
import LogConsole from './components/LogConsole.vue'
import PromptPanel from './components/PromptPanel.vue'
import BatchReviewBanner from './components/BatchReviewBanner.vue'
import CodeReviewPanel from './components/CodeReviewPanel.vue'
import { useDashboard } from './composables/useDashboard'

const { agentStatuses, tickets, logs, connected, pendingBatch, pendingCodeReview, workflowRunning } = useDashboard()

const open = ref({
  prompt:  true,
  agents:  true,
  tickets: true,
  logs:    false,
})

function toggle(key: keyof typeof open.value) {
  open.value[key] = !open.value[key]
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-zinc-100">

    <!-- Header -->
    <header class="sticky top-0 z-50 bg-zinc-950/85 border-b border-zinc-800/70 backdrop-blur-md">
      <div class="max-w-[1600px] mx-auto px-7 h-14 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <span class="text-[15px] font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent tracking-tight">
            AI Multi Agent Stack
          </span>
          <span class="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            Dashboard
          </span>
        </div>
        <div class="flex items-center gap-2 text-sm font-medium">
          <span
            class="w-2 h-2 rounded-full transition-all duration-300"
            :class="connected ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-zinc-600'"
          />
          <span :class="connected ? 'text-emerald-400' : 'text-zinc-500'">
            {{ connected ? 'Live' : 'Connecting…' }}
          </span>
        </div>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-[1600px] mx-auto px-7 py-7 flex flex-col gap-5">

      <!-- Launch Workflow -->
      <section>
        <div
          class="flex items-center gap-3 mb-4 cursor-pointer select-none group"
          @click="toggle('prompt')"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-500 group-hover:text-zinc-400 transition-colors whitespace-nowrap">Launch Workflow</span>
          <div class="flex-1 h-px bg-zinc-800" />
          <ChevronIcon :open="open.prompt" />
        </div>
        <Transition v-bind="collapseTransition">
          <PromptPanel v-if="open.prompt" :workflow-running="workflowRunning" />
        </Transition>
      </section>

      <!-- Agent Pool -->
      <section>
        <div
          class="flex items-center gap-3 mb-4 cursor-pointer select-none group"
          @click="toggle('agents')"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-500 group-hover:text-zinc-400 transition-colors whitespace-nowrap">Agent Pool</span>
          <div class="flex-1 h-px bg-zinc-800" />
          <ChevronIcon :open="open.agents" />
        </div>
        <Transition v-bind="collapseTransition">
          <AgentGrid v-if="open.agents" :statuses="agentStatuses" />
        </Transition>
      </section>

      <!-- Ticket Board -->
      <section>
        <div
          class="flex items-center gap-3 mb-4 cursor-pointer select-none group"
          @click="toggle('tickets')"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-500 group-hover:text-zinc-400 transition-colors whitespace-nowrap">Ticket Board</span>
          <div class="flex-1 h-px bg-zinc-800" />
          <ChevronIcon :open="open.tickets" />
        </div>
        <Transition v-bind="collapseTransition">
          <div v-if="open.tickets" class="flex flex-col gap-4">
            <!-- Human-in-the-loop: Ticket batch review -->
            <BatchReviewBanner
              v-if="pendingBatch"
              :batch="pendingBatch"
              :tickets="tickets"
            />
            <!-- Human-in-the-loop: Code review (post AI-reviewer approval) -->
            <CodeReviewPanel
              v-if="pendingCodeReview"
              :review="pendingCodeReview"
            />
            <KanbanBoard :tickets="tickets" />
          </div>
        </Transition>
      </section>

      <!-- Log Console -->
      <section>
        <div
          class="flex items-center gap-3 mb-4 cursor-pointer select-none group"
          @click="toggle('logs')"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[1.2px] text-zinc-500 group-hover:text-zinc-400 transition-colors whitespace-nowrap">Log Console</span>
          <div class="flex-1 h-px bg-zinc-800" />
          <ChevronIcon :open="open.logs" />
        </div>
        <Transition v-bind="collapseTransition">
          <LogConsole v-if="open.logs" :logs="logs" />
        </Transition>
      </section>

    </main>
  </div>
</template>

<!-- Inline chevron so we don't need a separate file for a tiny icon -->
<script lang="ts">
import { defineComponent, h } from 'vue'

const ChevronIcon = defineComponent({
  props: { open: Boolean },
  setup(props) {
    return () => h('svg', {
      class: [
        'w-3.5 h-3.5 text-zinc-600 transition-all duration-200',
        'group-hover:text-zinc-400',
        props.open ? 'rotate-180' : '',
      ],
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '2.5',
    }, [
      h('path', {
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        d: 'M19 9l-7 7-7-7',
      })
    ])
  }
})

const collapseTransition = {
  enterActiveClass: 'transition-all duration-200 ease-out overflow-hidden',
  leaveActiveClass: 'transition-all duration-150 ease-in overflow-hidden',
  enterFromClass:   'opacity-0 max-h-0',
  enterToClass:     'opacity-100 max-h-[2000px]',
  leaveFromClass:   'opacity-100 max-h-[2000px]',
  leaveToClass:     'opacity-0 max-h-0',
}

export { ChevronIcon, collapseTransition }
</script>


