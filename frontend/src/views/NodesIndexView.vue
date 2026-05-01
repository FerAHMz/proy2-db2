<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { nodesApi } from '@/api/nodes'
import { PRIMARY_LABELS } from '@/api/schema'

const router = useRouter()
const counts = ref<Record<string, number | null>>({})
const loading = ref(true)

async function loadCounts() {
  loading.value = true
  await Promise.all(
    PRIMARY_LABELS.map(async (l) => {
      try {
        const res = await nodesApi.list(l, { limit: 1, skip: 0 })
        counts.value[l] = res.count
      } catch {
        counts.value[l] = null
      }
    }),
  )
  loading.value = false
}

onMounted(loadCounts)

function go(label: string) {
  router.push({ name: 'nodos.label', params: { label } })
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Explorar nodos</h2>
      <p class="text-sm text-slate-500">
        Selecciona una etiqueta primaria para ver, filtrar y abrir su ficha.
      </p>
    </div>
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <button
        v-for="label in PRIMARY_LABELS"
        :key="label"
        class="card card-body text-left hover:border-brand-400 hover:shadow-md transition-all"
        @click="go(label)"
      >
        <div class="flex items-start justify-between">
          <div>
            <div class="text-xs uppercase tracking-wider text-slate-500">Label</div>
            <div class="text-lg font-semibold text-slate-900 mt-0.5">{{ label }}</div>
          </div>
          <div class="text-brand-600">→</div>
        </div>
        <div class="mt-3 text-xs text-slate-500">
          <span v-if="loading && counts[label] === undefined">…</span>
          <span v-else-if="counts[label] === null" class="text-rose-500">sin acceso</span>
          <span v-else>muestra de {{ counts[label] }}</span>
        </div>
      </button>
    </div>
  </div>
</template>
