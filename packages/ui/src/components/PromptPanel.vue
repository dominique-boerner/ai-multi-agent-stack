<script setup lang="ts">
import { ref } from 'vue'
import Textarea from 'primevue/textarea'
import InputText from 'primevue/inputtext'
import Button from 'primevue/button'

const props = defineProps<{
  workflowRunning: boolean
}>()

type Status = 'idle' | 'loading' | 'success' | 'error'

const userPrompt = ref('')
const additionalContext = ref('')
const status = ref<Status>('idle')
const statusMessage = ref('')

async function submit() {
  if (!userPrompt.value.trim()) return

  status.value = 'loading'
  statusMessage.value = ''

  try {
    const res = await fetch('/api/v1/projects/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_prompt: userPrompt.value.trim(),
        additional_context: additionalContext.value.trim() || undefined,
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error ?? `HTTP ${res.status}`)
    }

    status.value = 'success'
    statusMessage.value = 'Workflow started...'
    // Reset after a few seconds
    setTimeout(() => {
      status.value = 'idle'
      statusMessage.value = ''
    }, 5000)
  } catch (e: any) {
    status.value = 'error'
    statusMessage.value = e?.message ?? 'Unbekannter Fehler'
  }
}

function isSubmittable() {
  return userPrompt.value.trim().length > 0 && status.value !== 'loading' && !props.workflowRunning
}
</script>

<template>
  <div class="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">

    <!-- Workflow running banner -->
    <Transition name="fade">
      <div
        v-if="workflowRunning"
        class="flex items-center gap-3 px-5 py-3 bg-amber-500/10 border-b border-amber-500/20 text-amber-400"
      >
        <span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)] animate-pulse shrink-0" />
        <span class="text-xs font-semibold">
          A workflow is currently running — starting a new one is disabled until it finishes.
        </span>
      </div>
    </Transition>

    <!-- Header -->
    <div class="flex items-center gap-2 px-5 py-3 bg-zinc-900 border-b border-zinc-800">
      <span class="text-[11px] font-bold uppercase tracking-widest text-zinc-500">New Project Prompt</span>
    </div>

    <!-- Form -->
    <div class="p-5 flex flex-col gap-4">

      <!-- Main prompt -->
      <div class="flex flex-col gap-1.5">
        <label for="user-prompt" class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Prompt <span class="text-red-400">*</span>
        </label>
        <Textarea
          id="user-prompt"
          v-model="userPrompt"
          placeholder="Describe the project you want the agents to build…"
          :rows="4"
          :disabled="status === 'loading' || workflowRunning"
          class="w-full resize-y"
          :pt="{
            root: {
              class: [
                'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5',
                'text-sm text-zinc-100 placeholder:text-zinc-600 font-mono',
                'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150',
                'resize-y'
              ].join(' ')
            }
          }"
        />
      </div>

      <!-- Additional context (optional) -->
      <div class="flex flex-col gap-1.5">
        <label for="additional-context" class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Additional Context <span class="text-zinc-600 font-normal normal-case">(optional)</span>
        </label>
        <InputText
          id="additional-context"
          v-model="additionalContext"
          placeholder="e.g. Use TypeScript, strict error handling, add unit tests…"
          :disabled="status === 'loading' || workflowRunning"
          :pt="{
            root: {
              class: [
                'w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3.5 py-2.5',
                'text-sm text-zinc-300 placeholder:text-zinc-600',
                'focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-colors duration-150',
              ].join(' ')
            }
          }"
        />
      </div>

      <!-- Footer row -->
      <div class="flex items-center justify-between pt-1 gap-4">

        <!-- Status feedback -->
        <Transition name="fade">
          <div
            v-if="statusMessage"
            class="flex items-center gap-2 text-sm font-medium"
            :class="{
              'text-emerald-400': status === 'success',
              'text-red-400':    status === 'error',
            }"
          >
            <span>{{ status === 'success' ? '✅' : '❌' }}</span>
            <span>{{ statusMessage }}</span>
          </div>
          <div v-else class="text-xs text-zinc-600">
            The workflow will start asynchronously — track progress in the Agent Pool and Ticket Board above.
          </div>
        </Transition>

        <!-- Submit button -->
        <Button
          label="Start Workflow"
          :loading="status === 'loading'"
          :disabled="!isSubmittable()"
          @click="submit"
          :pt="{
            root: {
              class: [
                'flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold',
                'bg-gradient-to-r from-indigo-600 to-violet-600',
                'hover:from-indigo-500 hover:to-violet-500',
                'text-white shadow-lg shadow-indigo-500/20',
                'disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none',
                'transition-all duration-200 ease-out',
                'shrink-0',
              ].join(' ')
            }
          }"
        />
      </div>
    </div>

  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
