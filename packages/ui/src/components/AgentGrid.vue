<script setup lang="ts">
import { computed } from 'vue'
import Card from 'primevue/card'
import Tag from 'primevue/tag'
import type { AgentStatuses } from '../types/dashboard'

const props = defineProps<{ statuses: AgentStatuses }>()

const agents = computed(() => Object.entries(props.statuses))

function isActive(status: string) {
  return status !== 'IDLE'
}

function guessRole(id: string): string {
  const lower = id.toLowerCase()
  if (lower.includes('po') || lower.includes('product')) return 'Product Owner'
  if (lower.includes('reviewer') || lower.includes('senior')) return 'Code Reviewer'
  if (lower.includes('dev')) return 'Developer'
  return 'Agent'
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ')
}
</script>

<template>
  <div v-if="agents.length === 0" class="flex items-center gap-3 text-zinc-500 text-sm py-6">
    <span class="animate-spin border-2 border-zinc-700 border-t-indigo-500 rounded-full w-4 h-4 block" />
    Waiting for agents…
  </div>

  <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
    <Card
      v-for="[id, status] in agents"
      :key="id"
      class="!bg-zinc-900/80 !border !rounded-xl transition-all duration-300 !shadow-none"
      :class="isActive(status)
        ? '!border-indigo-500/50 shadow-lg shadow-indigo-500/10'
        : '!border-zinc-800'"
      :pt="{ body: { class: 'p-0' }, content: { class: '!p-5' } }"
    >
      <template #header>
        <!-- Active top-bar indicator -->
        <div
          class="h-0.5 w-full rounded-t-xl transition-all duration-500"
          :class="isActive(status) ? 'bg-gradient-to-r from-indigo-500 to-violet-500' : 'bg-zinc-800'"
        />
      </template>

      <template #content>
        <p class="font-mono text-sm font-semibold text-white mb-0.5 truncate">{{ id }}</p>
        <p class="text-[11px] text-zinc-500 uppercase tracking-widest mb-4">{{ guessRole(id) }}</p>

        <Tag
          :value="statusLabel(status)"
          :pt="{
            root: {
              class: isActive(status)
                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 text-xs font-medium px-2.5 py-1 rounded-full'
                : 'bg-zinc-800 text-zinc-400 border border-zinc-700 text-xs font-medium px-2.5 py-1 rounded-full'
            }
          }"
        >
          <template #default>
            <span class="flex items-center gap-1.5">
              <span
                class="w-1.5 h-1.5 rounded-full"
                :class="isActive(status) ? 'bg-indigo-400 animate-pulse' : 'bg-zinc-500'"
              />
              {{ statusLabel(status) }}
            </span>
          </template>
        </Tag>
      </template>
    </Card>
  </div>
</template>
