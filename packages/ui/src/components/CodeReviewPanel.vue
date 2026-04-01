<script setup lang="ts">
import { ref, computed } from 'vue'
import type { CodeReviewRequest } from '../types/dashboard'

const props = defineProps<{ review: CodeReviewRequest }>()

const activeFile = ref(0)
const feedback = ref('')
const status = ref<'idle' | 'loading' | 'error'>('idle')
const errorMsg = ref('')

const currentFile = computed(() => props.review.files[activeFile.value])

// Simple language detection by extension
function detectLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'TypeScript', tsx: 'TSX', js: 'JavaScript', jsx: 'JSX',
    vue: 'Vue', html: 'HTML', css: 'CSS', json: 'JSON',
    md: 'Markdown', sh: 'Shell', yml: 'YAML', yaml: 'YAML',
    py: 'Python', rs: 'Rust', go: 'Go', sql: 'SQL',
  }
  return map[ext] ?? ext.toUpperCase()
}

async function submit(action: 'approve' | 'reject') {
  if (action === 'reject' && !feedback.value.trim()) return

  status.value = 'loading'
  errorMsg.value = ''

  try {
    const body: Record<string, string> = { action }
    if (action === 'reject') body.feedback = feedback.value.trim()

    const res = await fetch(`/api/v1/tickets/${props.review.ticketId}/code-review`, {
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
  } catch (e: any) {
    status.value = 'error'
    errorMsg.value = e?.message ?? 'Unknown error'
  }
}
</script>

<template>
  <div class="rounded-xl border border-purple-500/30 bg-purple-500/5 overflow-hidden">

    <!-- Header -->
    <div class="flex items-center gap-3 px-5 py-3 bg-purple-500/10 border-b border-purple-500/20">
      <span class="relative flex h-2.5 w-2.5 shrink-0">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
        <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-purple-400" />
      </span>
      <span class="text-[11px] font-bold uppercase tracking-widest text-purple-400">
        Code Review Required
      </span>
      <span class="ml-2 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/20 font-mono text-[10px] text-purple-300">
        {{ review.ticketId }}
      </span>
      <span class="text-xs text-purple-300/70 truncate">{{ review.ticketTitle }}</span>
      <span class="ml-auto text-[10px] text-purple-500/70 font-medium">
        {{ review.files.length }} file{{ review.files.length !== 1 ? 's' : '' }}
        <template v-if="review.deletedFiles?.length">
          · {{ review.deletedFiles.length }} deleted
        </template>
      </span>
    </div>

    <div class="flex flex-col gap-0">

      <!-- File tabs -->
      <div class="flex items-end gap-0 overflow-x-auto border-b border-zinc-800 bg-zinc-950/40 px-4 pt-2">
        <button
          v-for="(file, idx) in review.files"
          :key="file.path"
          class="relative px-3.5 py-2 text-[11px] font-mono whitespace-nowrap transition-colors duration-100 border-b-2 -mb-px"
          :class="activeFile === idx
            ? 'text-purple-300 border-purple-500 bg-zinc-900/60'
            : 'text-zinc-500 border-transparent hover:text-zinc-300'"
          @click="activeFile = idx"
        >
          {{ file.path.split('/').pop() }}
          <span v-if="activeFile !== idx" class="ml-1 text-zinc-600 text-[9px]">{{ file.path.split('/').slice(0, -1).join('/') || '.' }}</span>
        </button>
        <!-- Deleted files (non-clickable, visual indicator) -->
        <span
          v-for="f in review.deletedFiles"
          :key="f"
          class="px-3.5 py-2 text-[11px] font-mono text-red-500/60 line-through border-b-2 border-transparent -mb-px"
        >{{ f.split('/').pop() }}</span>
      </div>

      <!-- File path breadcrumb -->
      <div class="px-4 py-1.5 bg-zinc-950/60 border-b border-zinc-800/60 flex items-center justify-between">
        <span class="font-mono text-[10px] text-zinc-500">{{ currentFile?.path }}</span>
        <span class="text-[10px] text-zinc-600">{{ detectLanguage(currentFile?.path ?? '') }}</span>
      </div>

      <!-- Code view -->
      <div class="max-h-[400px] overflow-auto bg-zinc-950">
        <pre class="text-xs text-zinc-300 leading-relaxed p-4 font-mono whitespace-pre overflow-x-auto"><code>{{ currentFile?.content }}</code></pre>
      </div>

      <!-- Review actions -->
      <div class="px-5 py-4 border-t border-zinc-800 flex flex-col gap-3 bg-zinc-900/40">
        <div class="flex flex-col gap-1.5">
          <label class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
            Feedback
            <span class="text-zinc-600 normal-case font-normal">(required to reject)</span>
          </label>
          <textarea
            v-model="feedback"
            rows="2"
            placeholder="e.g. The error handling is missing edge cases…"
            class="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 font-mono resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/20 transition-colors duration-150"
            :disabled="status === 'loading'"
          />
        </div>

        <p v-if="errorMsg" class="text-xs text-red-400">❌ {{ errorMsg }}</p>

        <div class="flex items-center justify-end gap-3">
          <button
            class="px-4 py-2 rounded-lg text-sm font-semibold border transition-all duration-150"
            :class="feedback.trim()
              ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
              : 'border-zinc-700 text-zinc-500 cursor-not-allowed opacity-50'"
            :disabled="status === 'loading' || !feedback.trim()"
            @click="submit('reject')"
          >
            Reject & Send Back
          </button>
          <button
            class="px-5 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
            :disabled="status === 'loading'"
            @click="submit('approve')"
          >
            <span v-if="status === 'loading'">Processing…</span>
            <span v-else>Approve & Write to Disk →</span>
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
