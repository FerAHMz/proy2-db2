<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { analyticsApi, type GraphSnapshot } from '@/api/analytics'
import { ID_FIELD, PRIMARY_LABELS } from '@/api/schema'
import GraphView from '@/components/GraphView.vue'
import { fmtNum } from '@/lib/format'

const router = useRouter()
const limit = ref(200)
const data = ref<GraphSnapshot | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await analyticsApi.grafo(limit.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al consultar el grafo'
  } finally {
    loading.value = false
  }
}

onMounted(load)

function pickIdValue(node: { properties: Record<string, unknown> }) {
  for (const f of Object.values(ID_FIELD)) {
    if (f in node.properties) return String(node.properties[f])
  }
  return null
}

const graphNodes = computed(() => {
  if (!data.value) return []
  return data.value.nodes.map((n) => {
    const id = pickIdValue(n)
    const lbl = n.labels[0] || '?'
    return {
      id: n._id,
      label: id ? `${lbl}\n${id}` : lbl,
      group: lbl,
      title: n.labels.join(':'),
    }
  })
})

const graphEdges = computed(() => {
  if (!data.value) return []
  return data.value.edges.map((e) => ({
    from: e.startId,
    to: e.endId,
    label: e.type,
    title: Object.entries(e.properties).map(([k, v]) => `${k}: ${v}`).join('\n'),
  }))
})

const nodesByLabel = computed(() => {
  if (!data.value) return [] as { label: string; count: number; color: string }[]
  const map = new Map<string, number>()
  for (const n of data.value.nodes) {
    const l = n.labels[0] || '?'
    map.set(l, (map.get(l) ?? 0) + 1)
  }
  const colors: Record<string, string> = {
    Cliente: '#7c3aed', Cuenta: '#0ea5e9', Tarjeta: '#10b981',
    Transaccion: '#f59e0b', Dispositivo: '#6366f1', Ubicacion: '#14b8a6',
    Comercio: '#ec4899', AlertaFraude: '#ef4444',
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, color: colors[label] || '#94a3b8' }))
})

function onSelectNode(visId: string) {
  const node = data.value?.nodes.find((n) => n._id === visId)
  if (!node) return
  const lbl = node.labels[0]
  if (!(PRIMARY_LABELS as readonly string[]).includes(lbl)) return
  const id = pickIdValue(node)
  if (!id) return
  router.push({ name: 'nodos.detail', params: { label: lbl, id } })
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Grafo del sistema</h2>
      <p class="text-sm text-slate-500">
        Subgrafo conexo del modelo. Toma una muestra de nodos y muestra las
        relaciones existentes entre ellos. Click en un nodo para abrir su ficha.
      </p>
    </div>

    <div class="card">
      <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <div>
          <label class="label">Nodos a muestrear</label>
          <select v-model.number="limit" class="input">
            <option :value="50">50 nodos</option>
            <option :value="100">100 nodos</option>
            <option :value="200">200 nodos</option>
            <option :value="400">400 nodos</option>
            <option :value="800">800 nodos</option>
            <option :value="2000">2,000 nodos</option>
            <option :value="6000">6,000 nodos (todo el grafo)</option>
          </select>
          <p v-if="limit >= 2000" class="text-[11px] text-amber-600 mt-1">
            Renderizar muchos nodos puede tardar varios segundos.
          </p>
        </div>
        <div class="md:col-span-2 flex justify-end">
          <button class="btn-primary" :disabled="loading" @click="load">
            {{ loading ? 'Consultando…' : 'Generar grafo' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="data" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Nodos en vista</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(data.node_count) }}
        </div>
      </div>
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Relaciones</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(data.edge_count) }}
        </div>
      </div>
      <div class="card card-body md:col-span-2">
        <div class="text-xs uppercase tracking-wider text-slate-500 mb-2">Distribución por label</div>
        <div class="flex flex-wrap gap-2 text-xs">
          <span
            v-for="row in nodesByLabel"
            :key="row.label"
            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-100"
          >
            <span class="w-2.5 h-2.5 rounded-full" :style="{ background: row.color }" />
            <span class="font-medium text-slate-700">{{ row.label }}</span>
            <span class="text-slate-500">{{ row.count }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div v-if="loading" class="text-sm text-slate-400 py-6 text-center">
          Cargando subgrafo…
        </div>
        <div v-else-if="error" class="text-sm text-rose-600">{{ error }}</div>
        <div v-else-if="!data?.nodes.length" class="text-sm text-slate-400 py-6 text-center">
          No hay nodos en la muestra.
        </div>
        <GraphView
          v-else
          :nodes="graphNodes"
          :edges="graphEdges"
          :height="640"
          @select="onSelectNode"
        />
      </div>
    </div>
  </div>
</template>
