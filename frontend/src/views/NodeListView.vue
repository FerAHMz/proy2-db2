<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { nodesApi, type NodeListItem } from '@/api/nodes'
import { ID_FIELD, PRIMARY_LABELS, type PrimaryLabel } from '@/api/schema'
import { formatPropValue, pickColumns } from '@/lib/props'
import { fmtNum } from '@/lib/format'

const route = useRoute()
const router = useRouter()

const label = computed<PrimaryLabel>(() => {
  const l = String(route.params.label)
  return (PRIMARY_LABELS as readonly string[]).includes(l)
    ? (l as PrimaryLabel)
    : 'Cliente'
})
const idField = computed(() => ID_FIELD[label.value])

const items = ref<NodeListItem[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const skip = ref(0)
const limit = ref(50)

const filterRows = reactive<{ key: string; value: string }[]>([
  { key: '', value: '' },
])

function whereObject(): Record<string, string> {
  const obj: Record<string, string> = {}
  for (const r of filterRows) {
    if (r.key && r.value) obj[r.key] = r.value
  }
  return obj
}

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await nodesApi.list(label.value, {
      limit: limit.value,
      skip: skip.value,
      where: whereObject(),
    })
    items.value = res.items
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al consultar'
  } finally {
    loading.value = false
  }
}

const columns = computed(() =>
  pickColumns(items.value.map((i) => i.n), idField.value, 6),
)

function applyFilter() {
  skip.value = 0
  load()
}

function nextPage() {
  skip.value += limit.value
  load()
}
function prevPage() {
  skip.value = Math.max(0, skip.value - limit.value)
  load()
}

function addRow() {
  filterRows.push({ key: '', value: '' })
}
function removeRow(i: number) {
  filterRows.splice(i, 1)
  if (!filterRows.length) filterRows.push({ key: '', value: '' })
}

function openDetail(item: NodeListItem) {
  const id = String(item.n.properties[idField.value])
  router.push({ name: 'nodos.detail', params: { label: label.value, id } })
}

watch(label, () => {
  skip.value = 0
  filterRows.splice(0, filterRows.length, { key: '', value: '' })
  load()
})

onMounted(load)
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between flex-wrap gap-3">
      <div>
        <div class="text-xs uppercase tracking-wider text-slate-500">Label</div>
        <h2 class="text-xl font-semibold text-slate-900">{{ label }}</h2>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <RouterLink :to="{ name: 'nodos' }" class="text-brand-600 hover:underline">
          ← cambiar label
        </RouterLink>
        <select
          v-model="limit"
          class="input w-auto text-xs"
          @change="applyFilter"
        >
          <option :value="20">20 por página</option>
          <option :value="50">50 por página</option>
          <option :value="100">100 por página</option>
          <option :value="200">200 por página</option>
        </select>
      </div>
    </div>

    <!-- Filter bar -->
    <div class="card">
      <div class="card-body space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">Filtros</h3>
          <span class="text-xs text-slate-400">
            equivalente a <code class="text-[11px]">where=k:v,k:v</code> (texto exacto)
          </span>
        </div>
        <div
          v-for="(row, i) in filterRows"
          :key="i"
          class="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
        >
          <div>
            <label class="label">Propiedad</label>
            <input v-model="row.key" placeholder="pais, estado…" class="input" />
          </div>
          <div>
            <label class="label">Valor</label>
            <input v-model="row.value" placeholder="GT, activa…" class="input"
                   @keyup.enter="applyFilter" />
          </div>
          <button class="btn-secondary text-xs px-2" @click="removeRow(i)">×</button>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary text-xs" @click="addRow">+ filtro</button>
          <button class="btn-primary text-xs" @click="applyFilter">Aplicar</button>
        </div>
      </div>
    </div>

    <!-- Table -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <div class="text-sm text-slate-700">
          <span class="font-semibold">{{ items.length }}</span>
          {{ items.length === 1 ? 'fila' : 'filas' }}
          · skip {{ fmtNum(skip) }}
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary text-xs" :disabled="skip === 0 || loading" @click="prevPage">
            ← anterior
          </button>
          <button class="btn-secondary text-xs" :disabled="loading || items.length < limit" @click="nextPage">
            siguiente →
          </button>
          <button class="btn-secondary text-xs" :disabled="loading" @click="load">↻</button>
        </div>
      </div>
      <div class="card-body p-0 overflow-x-auto">
        <div v-if="loading" class="p-5 text-sm text-slate-400">Cargando…</div>
        <div v-else-if="error" class="p-5 text-sm text-rose-600">{{ error }}</div>
        <div v-else-if="!items.length" class="p-5 text-sm text-slate-400">
          Sin resultados.
        </div>
        <table v-else class="min-w-full text-sm">
          <thead class="bg-slate-50 border-b border-slate-200">
            <tr>
              <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                Labels
              </th>
              <th
                v-for="col in columns"
                :key="col"
                class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500"
              >
                {{ col }}
              </th>
              <th class="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, i) in items"
              :key="i"
              class="border-b border-slate-100 hover:bg-brand-50/40 cursor-pointer"
              @click="openDetail(item)"
            >
              <td class="px-4 py-2">
                <span
                  v-for="l in item.labels"
                  :key="l"
                  class="badge-muted mr-1 text-[10px]"
                >
                  {{ l }}
                </span>
              </td>
              <td
                v-for="col in columns"
                :key="col"
                class="px-4 py-2 text-slate-700 max-w-[280px] truncate"
              >
                <span v-if="col === idField" class="font-mono text-xs">
                  {{ formatPropValue(item.n.properties[col]) }}
                </span>
                <span v-else>{{ formatPropValue(item.n.properties[col]) }}</span>
              </td>
              <td class="px-4 py-2 text-right text-brand-600 text-xs">→</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
