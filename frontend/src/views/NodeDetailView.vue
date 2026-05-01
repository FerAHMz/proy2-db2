<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { nodesApi, type NodeDetailResponse } from '@/api/nodes'
import { ID_FIELD, PRIMARY_LABELS, type PrimaryLabel } from '@/api/schema'
import { detectType, formatPropValue } from '@/lib/props'
import GraphView from '@/components/GraphView.vue'

const route = useRoute()
const router = useRouter()

const label = computed<PrimaryLabel>(() => {
  const l = String(route.params.label)
  return (PRIMARY_LABELS as readonly string[]).includes(l)
    ? (l as PrimaryLabel)
    : 'Cliente'
})
const id = computed(() => String(route.params.id))

const data = ref<NodeDetailResponse | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  data.value = null
  try {
    data.value = await nodesApi.get(label.value, id.value)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'No se encontró el nodo'
  } finally {
    loading.value = false
  }
}

const propsList = computed(() => {
  const obj = data.value?.n.properties || {}
  return Object.keys(obj)
    .sort()
    .map((k) => ({ key: k, value: obj[k], type: detectType(obj[k]) }))
})

const graphNodes = computed(() => {
  if (!data.value) return []
  const root = data.value.n
  const rootKey = `root-${root._id}`
  const set: { id: string; label: string; group?: string; title?: string }[] = [
    {
      id: rootKey,
      label: `${root.labels[0]}\n${id.value}`,
      group: root.labels[0],
      title: `Centro: ${root.labels.join(':')}`,
    },
  ]
  for (const c of data.value.connections) {
    set.push({
      id: c.other._id,
      label: `${c.otherLabels[0]}\n${pickIdValue(c.other)}`,
      group: c.otherLabels[0],
      title: c.otherLabels.join(':'),
    })
  }
  return set
})

const graphEdges = computed(() => {
  if (!data.value) return []
  const rootKey = `root-${data.value.n._id}`
  return data.value.connections.map((c) => ({
    from: rootKey,
    to: c.other._id,
    label: c.rel,
    title: Object.entries(c.props).map(([k, v]) => `${k}: ${v}`).join('\n'),
  }))
})

function pickIdValue(node: { properties: Record<string, unknown> }) {
  for (const f of Object.values(ID_FIELD)) {
    if (f in node.properties) return String(node.properties[f])
  }
  return Object.values(node.properties)[0]?.toString() || '?'
}

function openConnection(otherLabel: string, otherProps: Record<string, unknown>) {
  if (!(PRIMARY_LABELS as readonly string[]).includes(otherLabel)) return
  const idF = ID_FIELD[otherLabel as PrimaryLabel]
  const otherId = otherProps[idF]
  if (otherId == null) return
  router.push({ name: 'nodos.detail', params: { label: otherLabel, id: String(otherId) } })
}

watch([label, id], load)
onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center gap-3 text-sm">
      <RouterLink :to="{ name: 'nodos' }" class="text-brand-600 hover:underline">
        ← Explorar
      </RouterLink>
      <span class="text-slate-400">/</span>
      <RouterLink :to="{ name: 'nodos.label', params: { label } }" class="text-brand-600 hover:underline">
        {{ label }}
      </RouterLink>
      <span class="text-slate-400">/</span>
      <span class="font-mono text-slate-700">{{ id }}</span>
    </div>

    <div v-if="loading" class="card card-body text-slate-400 text-sm">Cargando ficha…</div>
    <div v-else-if="error" class="card card-body text-rose-600 text-sm">{{ error }}</div>

    <template v-else-if="data">
      <!-- Header -->
      <div class="card card-body">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">
              {{ data.n.properties.nombre || data.n.properties.name || id }}
            </h2>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                v-for="l in data.labels"
                :key="l"
                class="badge"
                :class="l === label ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-600'"
              >
                {{ l }}
              </span>
            </div>
          </div>
          <div class="text-right text-xs text-slate-500">
            <div>elementId</div>
            <div class="font-mono">{{ data.n._id }}</div>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- Properties -->
        <div class="card lg:col-span-1">
          <div class="card-header flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">Propiedades</h3>
            <span class="badge-muted">{{ propsList.length }}</span>
          </div>
          <div class="card-body p-0">
            <dl class="divide-y divide-slate-100">
              <div
                v-for="p in propsList"
                :key="p.key"
                class="px-5 py-2.5 flex items-start justify-between gap-3"
              >
                <div class="min-w-0">
                  <dt class="text-xs uppercase tracking-wider text-slate-500">{{ p.key }}</dt>
                  <dd class="text-sm text-slate-800 break-words mt-0.5">
                    {{ formatPropValue(p.value as never) }}
                  </dd>
                </div>
                <span class="badge-muted text-[10px] shrink-0">{{ p.type }}</span>
              </div>
            </dl>
          </div>
        </div>

        <!-- Graph -->
        <div class="card lg:col-span-2">
          <div class="card-header flex items-center justify-between">
            <h3 class="font-semibold text-slate-900">Grafo de conexiones</h3>
            <span class="badge-muted">{{ data.connections.length }} conexiones</span>
          </div>
          <div class="card-body">
            <div v-if="!data.connections.length" class="text-sm text-slate-400">
              Sin relaciones registradas.
            </div>
            <GraphView
              v-else
              :nodes="graphNodes"
              :edges="graphEdges"
              :height="440"
            />
          </div>
        </div>
      </div>

      <!-- Connections list -->
      <div v-if="data.connections.length" class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900">Conexiones</h3>
        </div>
        <div class="card-body p-0 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Tipo
                </th>
                <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Vecino
                </th>
                <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Propiedades de la relación
                </th>
                <th class="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(c, i) in data.connections"
                :key="i"
                class="border-b border-slate-100 hover:bg-slate-50"
              >
                <td class="px-4 py-2">
                  <span class="badge-info font-mono">{{ c.rel }}</span>
                </td>
                <td class="px-4 py-2">
                  <div class="flex items-center gap-1.5">
                    <span
                      v-for="l in c.otherLabels"
                      :key="l"
                      class="badge-muted text-[10px]"
                    >
                      {{ l }}
                    </span>
                  </div>
                  <div class="font-mono text-xs text-slate-600 mt-0.5">
                    {{ pickIdValue(c.other) }}
                  </div>
                </td>
                <td class="px-4 py-2 text-xs text-slate-600">
                  <div v-for="(v, k) in c.props" :key="k" class="font-mono">
                    <span class="text-slate-400">{{ k }}:</span> {{ formatPropValue(v as never) }}
                  </div>
                </td>
                <td class="px-4 py-2 text-right">
                  <button
                    class="text-brand-600 hover:underline text-xs"
                    @click="openConnection(c.otherLabels[0], c.other.properties)"
                  >
                    abrir →
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
