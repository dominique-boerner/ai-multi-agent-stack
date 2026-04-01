<script setup lang="ts">
import {ref, computed} from 'vue'
import Badge from 'primevue/badge'
import TicketSidebar from './TicketSidebar.vue'
import type {Ticket} from '../types/dashboard'

const props = defineProps<{ tickets: Ticket[] }>()

const selectedTicket = ref<Ticket | null>(null)

type Status = 'NEEDS_HUMAN_REVIEW' | 'OPEN' | 'IN_PROGRESS' | 'IN_REVIEW' | 'NEEDS_CODE_REVIEW' | 'DONE'

// All possible statuses
const allStatuses: Status[] = ['NEEDS_HUMAN_REVIEW', 'OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_CODE_REVIEW', 'DONE']
const activeFilters = ref<Set<Status>>(new Set(['NEEDS_HUMAN_REVIEW', 'OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'NEEDS_CODE_REVIEW', 'DONE']))

function toggleFilter(status: Status) {
  if (activeFilters.value.has(status)) {
    activeFilters.value.delete(status)
  } else {
    activeFilters.value.add(status)
  }
  // Trigger reactivity (Set mutations aren't tracked automatically)
  activeFilters.value = new Set(activeFilters.value)
}

const filteredTickets = computed(() =>
    props.tickets.filter(t => activeFilters.value.has(t.status as Status))
)

const columns = computed(() => ({
  NEEDS_HUMAN_REVIEW: filteredTickets.value.filter(t => t.status === 'NEEDS_HUMAN_REVIEW'),
  OPEN: filteredTickets.value.filter(t => t.status === 'OPEN'),
  IN_PROGRESS: filteredTickets.value.filter(t => t.status === 'IN_PROGRESS'),
  IN_REVIEW: filteredTickets.value.filter(t => t.status === 'IN_REVIEW'),
  NEEDS_CODE_REVIEW: filteredTickets.value.filter(t => t.status === 'NEEDS_CODE_REVIEW'),
  DONE: filteredTickets.value.filter(t => t.status === 'DONE'),
}))

// Count per status across ALL tickets (not just filtered)
const totalCounts = computed(() => {
  const counts: Record<Status, number> = {NEEDS_HUMAN_REVIEW: 0, OPEN: 0, IN_PROGRESS: 0, IN_REVIEW: 0, NEEDS_CODE_REVIEW: 0, DONE: 0}
  for (const t of props.tickets) {
    if (t.status in counts) counts[t.status as Status]++
  }
  return counts
})

const columnConfig: {
  key: Status
  label: string
  topColor: string
  labelColor: string
  badgeClass: string
  filterActive: string
  filterInactive: string
}[] = [
  {
    key: 'NEEDS_HUMAN_REVIEW',
    label: 'Needs Human Review',
    topColor: 'border-t-amber-500',
    labelColor: 'text-amber-400',
    badgeClass: '!bg-amber-500/15 !text-amber-300',
    filterActive: 'bg-amber-500/15 border-amber-500/40 text-amber-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
  {
    key: 'OPEN',
    label: 'Open',
    topColor: 'border-t-blue-500',
    labelColor: 'text-blue-400',
    badgeClass: '!bg-blue-500/15 !text-blue-300',
    filterActive: 'bg-blue-500/15 border-blue-500/40 text-blue-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
  {
    key: 'IN_PROGRESS',
    label: 'In Progress',
    topColor: 'border-t-yellow-500',
    labelColor: 'text-yellow-400',
    badgeClass: '!bg-yellow-500/15 !text-yellow-300',
    filterActive: 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
  {
    key: 'IN_REVIEW',
    label: 'In Review',
    topColor: 'border-t-violet-500',
    labelColor: 'text-violet-400',
    badgeClass: '!bg-violet-500/15 !text-violet-300',
    filterActive: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
  {
    key: 'NEEDS_CODE_REVIEW',
    label: 'Code Review',
    topColor: 'border-t-purple-500',
    labelColor: 'text-purple-400',
    badgeClass: '!bg-purple-500/15 !text-purple-300',
    filterActive: 'bg-purple-500/15 border-purple-500/40 text-purple-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
  {
    key: 'DONE',
    label: 'Done',
    topColor: 'border-t-emerald-500',
    labelColor: 'text-emerald-400',
    badgeClass: '!bg-emerald-500/15 !text-emerald-300',
    filterActive: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
    filterInactive: 'bg-transparent border-zinc-700 text-zinc-500 hover:border-zinc-600',
  },
]
</script>

<template>
  <div class="flex flex-col gap-3">

    <!-- Filter bar -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="text-[10px] font-semibold uppercase tracking-widest text-zinc-600 mr-1">Show:</span>
      <button
          v-for="col in columnConfig"
          :key="col.key"
          class="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-all duration-150"
          :class="activeFilters.has(col.key) ? col.filterActive : col.filterInactive"
          @click="toggleFilter(col.key)"
      >
        <!-- Checkmark when active -->
        <svg v-if="activeFilters.has(col.key)" class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
        </svg>
        {{ col.label }}
        <span class="text-[10px] opacity-60">({{ totalCounts[col.key] }})</span>
      </button>

      <!-- Total tickets -->
      <span class="ml-auto text-[10px] text-zinc-600 font-medium">
        {{ filteredTickets.length }} / {{ tickets.length }} tickets
      </span>
    </div>

    <!-- Kanban columns — only render columns that are in activeFilters -->
    <div
        class="grid gap-4"
        :style="`grid-template-columns: repeat(${activeFilters.size || 1}, minmax(0, 1fr))`"
    >
      <template v-for="col in columnConfig" :key="col.key">
        <div
            v-if="activeFilters.has(col.key)"
            class="bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 border-t-2 max-h-[480px]"
            :class="col.topColor"
        >
          <!-- Column header -->
          <div class="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span class="text-[11px] font-bold uppercase tracking-widest" :class="col.labelColor">
              {{ col.label }}
            </span>
            <Badge
                :value="String(columns[col.key].length)"
                :pt="{ root: { class: `text-[10px] font-bold px-2 py-0.5 rounded-full ${col.badgeClass}` } }"
            />
          </div>

          <!-- Ticket cards (scrollable) -->
          <div class="flex flex-col gap-3 overflow-y-auto">
            <template v-if="columns[col.key].length > 0">
              <!-- Plain div instead of PrimeVue Card — needed for Tailwind group-hover on the icon -->
              <div
                  v-for="ticket in columns[col.key]"
                  :key="ticket.id"
                  class="group relative bg-zinc-950/70 border border-zinc-800 rounded-lg p-3.5 hover:border-zinc-600 hover:bg-zinc-900/80 transition-all duration-150 cursor-pointer"
                  @click="selectedTicket = ticket"
              >
                <!-- Expand icon — visible on hover -->
                <div class="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-zinc-500">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </div>

                <p class="font-mono text-[10px] text-zinc-500 font-bold tracking-wider mb-1.5 pr-5">
                  {{ ticket.id }}
                </p>
                <p class="text-xs font-medium text-zinc-200 leading-snug">
                  {{ ticket.title }}
                </p>
              </div>
            </template>

            <p v-else class="text-center text-xs text-zinc-600 py-4">Empty</p>
          </div>
        </div>
      </template>
    </div>

  </div>

  <!-- Ticket detail sidebar -->
  <Transition
    enter-active-class="transition-transform duration-250 ease-out"
    leave-active-class="transition-transform duration-200 ease-in"
    enter-from-class="translate-x-full"
    enter-to-class="translate-x-0"
    leave-from-class="translate-x-0"
    leave-to-class="translate-x-full"
  >
    <TicketSidebar
      v-if="selectedTicket"
      :ticket="selectedTicket"
      @close="selectedTicket = null"
    />
  </Transition>

</template>
