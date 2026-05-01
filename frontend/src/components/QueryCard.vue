<script setup lang="ts">
defineProps<{
  title: string
  question: string
  endpoint: string
  loading?: boolean
  error?: string | null
  count?: number
  presenter?: string
}>()

defineEmits<{ (e: 'reload'): void }>()
</script>

<template>
  <section class="card flex flex-col">
    <header class="card-header">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="font-semibold text-slate-900">{{ title }}</h3>
            <span v-if="presenter" class="badge-info">{{ presenter }}</span>
            <span v-if="typeof count === 'number'" class="badge-muted">
              {{ count }} {{ count === 1 ? 'fila' : 'filas' }}
            </span>
          </div>
          <p class="text-sm text-slate-500 mt-1">{{ question }}</p>
          <code class="text-[11px] text-slate-400 mt-1 block font-mono truncate">
            GET {{ endpoint }}
          </code>
        </div>
        <button
          class="btn-secondary text-xs px-2 py-1 shrink-0"
          :disabled="loading"
          @click="$emit('reload')"
        >
          {{ loading ? '…' : '↻' }}
        </button>
      </div>
      <div v-if="$slots.params" class="mt-3 flex flex-wrap items-end gap-3">
        <slot name="params" />
      </div>
    </header>
    <div class="card-body flex-1 min-h-[120px]">
      <div v-if="loading" class="text-sm text-slate-400">Consultando Neo4j…</div>
      <div v-else-if="error" class="text-sm text-rose-600">{{ error }}</div>
      <slot v-else />
    </div>
  </section>
</template>
