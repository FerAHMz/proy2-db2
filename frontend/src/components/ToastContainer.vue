<script setup lang="ts">
import { useToasts } from '@/stores/toasts'

const toasts = useToasts()

const styles = {
  success: 'bg-emerald-600 text-white',
  error:   'bg-rose-600 text-white',
  info:    'bg-slate-800 text-white',
}

const icons = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
}
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm">
      <TransitionGroup
        enter-active-class="transition duration-200"
        enter-from-class="opacity-0 translate-x-4"
        leave-active-class="transition duration-150"
        leave-to-class="opacity-0 translate-x-4"
      >
        <div
          v-for="t in toasts.toasts"
          :key="t.id"
          :class="['flex items-start gap-3 px-4 py-3 rounded-lg shadow-lg text-sm', styles[t.type]]"
        >
          <span class="font-bold">{{ icons[t.type] }}</span>
          <span class="flex-1">{{ t.message }}</span>
          <button class="opacity-70 hover:opacity-100" @click="toasts.dismiss(t.id)">×</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>
