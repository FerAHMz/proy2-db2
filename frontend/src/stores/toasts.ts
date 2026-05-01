import { defineStore } from 'pinia'
import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  message: string
}

export const useToasts = defineStore('toasts', () => {
  const toasts = ref<Toast[]>([])
  let nextId = 1

  function push(type: ToastType, message: string, ttlMs = 4000) {
    const id = nextId++
    toasts.value.push({ id, type, message })
    if (ttlMs > 0) {
      setTimeout(() => dismiss(id), ttlMs)
    }
    return id
  }

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((t) => t.id !== id)
  }

  return {
    toasts,
    push,
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
    dismiss,
  }
})
