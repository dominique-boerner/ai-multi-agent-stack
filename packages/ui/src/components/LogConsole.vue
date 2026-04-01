<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import ScrollPanel from 'primevue/scrollpanel'
import Button from 'primevue/button'
import type { LogEntry } from '../types/dashboard'

const props = defineProps<{ logs: LogEntry[] }>()

const autoScroll = ref(true)
const scrollRef = ref<InstanceType<typeof ScrollPanel> | null>(null)

const levelStyles: Record<string, string> = {
  TRACE: 'text-zinc-500',
  DEBUG: 'text-blue-400',
  INFO:  'text-cyan-400',
  WARN:  'text-yellow-400',
  ERROR: 'text-red-400',
}

const rowStyles: Record<string, string> = {
  WARN:  'bg-yellow-500/5',
  ERROR: 'bg-red-500/8',
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
}

function clearLogs() {
  // Emit an event or mutate via the parent — for simplicity we just hide the UI list
  // The parent holds the source of truth; this is a display-only clear
  displayedLogs.value = []
}

// Local copy so "Clear" works without mutating the composable's ref
const displayedLogs = ref<LogEntry[]>([...props.logs])

watch(() => props.logs, (newLogs) => {
  displayedLogs.value = [...newLogs]
  if (autoScroll.value) {
    nextTick(() => {
      const el = scrollRef.value?.$el?.querySelector('.p-scrollpanel-content')
      if (el) el.scrollTop = el.scrollHeight
    })
  }
}, { deep: true })
</script>

<template>
  <div class="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between px-5 py-3 bg-zinc-900 border-b border-zinc-800">
      <div class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-zinc-500">
        Live Log Console
      </div>
      <div class="log-actions flex items-center gap-2">
        <!-- Plain native toggle — avoids PrimeVue ToggleButton rendering quirks -->
        <button
          @click="autoScroll = !autoScroll"
          class="text-[11px] font-semibold px-3 py-1.5 rounded-md border transition-all duration-150"
          :class="autoScroll
            ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300'
            : 'bg-transparent border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200'"
        >
          {{ autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF' }}
        </button>
        <Button
          label="Clear"
          severity="secondary"
          size="small"
          @click="clearLogs"
          :pt="{
            root: { class: 'text-[11px] font-medium px-3 py-1.5 rounded-md bg-transparent border border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200 transition-all' }
          }"
        />
      </div>
    </div>

    <!-- Log entries -->
    <ScrollPanel
      ref="scrollRef"
      style="height: 320px"
      :pt="{
        wrapper: { class: 'rounded-none' },
        content: { class: 'p-0 font-mono text-[12px]' }
      }"
    >
      <div v-if="displayedLogs.length === 0" class="flex items-center gap-3 text-zinc-600 text-sm py-8 justify-center">
        <span class="animate-spin border-2 border-zinc-700 border-t-indigo-500 rounded-full w-4 h-4 block" />
        Awaiting log stream…
      </div>

      <div
        v-for="(entry, i) in displayedLogs"
        :key="i"
        class="grid gap-3 px-5 py-0.5 hover:bg-white/[0.02] transition-colors leading-7"
        :class="[rowStyles[entry.level] ?? '', 'grid-cols-[78px_52px_130px_1fr]']"
      >
        <span class="text-zinc-600 text-[11px] self-center">{{ formatTime(entry.timestamp) }}</span>
        <span class="font-bold text-[10px] tracking-wider self-center" :class="levelStyles[entry.level] ?? 'text-zinc-400'">
          {{ entry.level }}
        </span>
        <span class="text-violet-400 truncate self-center">[{{ entry.context }}]</span>
        <span class="text-zinc-200 break-words">{{ entry.message }}</span>
      </div>
    </ScrollPanel>
  </div>
</template>
