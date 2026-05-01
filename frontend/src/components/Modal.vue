<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from 'vue'

const props = defineProps<{
  open: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
}>()

const emit = defineEmits<{ (e: 'close'): void }>()

function handleEsc(ev: KeyboardEvent) {
  if (ev.key === 'Escape' && props.open) emit('close')
}

onMounted(() => document.addEventListener('keydown', handleEsc))
onBeforeUnmount(() => document.removeEventListener('keydown', handleEsc))

watch(
  () => props.open,
  (v) => {
    document.body.style.overflow = v ? 'hidden' : ''
  },
)

const sizeClass: Record<NonNullable<typeof props.size>, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150"
      enter-from-class="opacity-0"
      leave-active-class="transition duration-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-start justify-center p-6"
        @click.self="emit('close')"
      >
        <div
          class="bg-white rounded-xl shadow-xl w-full mt-12"
          :class="sizeClass[size || 'md']"
          @click.stop
        >
          <div v-if="title" class="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">{{ title }}</h3>
            <button class="text-slate-400 hover:text-slate-700" @click="emit('close')">×</button>
          </div>
          <div class="p-5">
            <slot />
          </div>
          <div v-if="$slots.footer" class="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
