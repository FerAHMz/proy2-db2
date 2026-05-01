<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { nodesApi, type NodeListItem } from '@/api/nodes'
import { ID_FIELD, PRIMARY_LABELS, type PrimaryLabel } from '@/api/schema'
import { formatPropValue, pickColumns } from '@/lib/props'
import { fmtNum } from '@/lib/format'
import Modal from '@/components/Modal.vue'
import PropertyEditor from '@/components/PropertyEditor.vue'
import { defaultEntry, entriesToObject, type PropEntry } from '@/lib/coerce'

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

// === Selection (for multi-delete) ===
const selectedIds = ref<Set<string>>(new Set())

function toggleRow(item: NodeListItem) {
  const id = String(item.n.properties[idField.value])
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
  selectedIds.value = new Set(selectedIds.value)
}

function toggleAll() {
  if (selectedIds.value.size === items.value.length) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(items.value.map((it) => String(it.n.properties[idField.value])))
  }
}

function isSelected(item: NodeListItem) {
  return selectedIds.value.has(String(item.n.properties[idField.value]))
}

watch([label, skip, limit], () => {
  selectedIds.value = new Set()
})

// === Bulk actions ===
type BulkMode = 'set' | 'remove' | 'delete-ids' | 'delete-filter' | null
const bulkMode = ref<BulkMode>(null)
const bulkProps = ref<PropEntry[]>([defaultEntry()])
const bulkRemoveNames = ref<string>('')
const bulkBusy = ref(false)
const bulkError = ref<string | null>(null)
const bulkResult = ref<string | null>(null)

function openBulk(mode: BulkMode) {
  bulkMode.value = mode
  bulkProps.value = [defaultEntry()]
  bulkRemoveNames.value = ''
  bulkError.value = null
  bulkResult.value = null
}

async function submitBulk() {
  bulkBusy.value = true
  bulkError.value = null
  bulkResult.value = null
  try {
    const filter = whereObject()
    if (bulkMode.value === 'set') {
      const properties = entriesToObject(bulkProps.value)
      const res = await nodesApi.patchPropsBulk(label.value, filter, properties)
      bulkResult.value = `${res.updated} nodo(s) actualizados.`
    } else if (bulkMode.value === 'remove') {
      const names = bulkRemoveNames.value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (!names.length) throw new Error('Indica al menos una propiedad')
      const res = await nodesApi.removePropsBulk(label.value, filter, names)
      bulkResult.value = `${res.updated} nodo(s) actualizados.`
    } else if (bulkMode.value === 'delete-ids') {
      const ids = Array.from(selectedIds.value)
      if (!ids.length) throw new Error('Selecciona al menos un nodo')
      const res = await nodesApi.deleteBulk(label.value, { ids })
      bulkResult.value = `${res.deleted} nodo(s) eliminados.`
      selectedIds.value = new Set()
    } else if (bulkMode.value === 'delete-filter') {
      if (!Object.keys(filter).length) {
        throw new Error('Aplica al menos un filtro para borrar masivamente (protección).')
      }
      const res = await nodesApi.deleteBulk(label.value, { filter })
      bulkResult.value = `${res.deleted} nodo(s) eliminados.`
    }
    await load()
  } catch (e: unknown) {
    bulkError.value = e instanceof Error ? e.message : 'Error en la operación masiva'
  } finally {
    bulkBusy.value = false
  }
}

const bulkTitle = computed(() => {
  switch (bulkMode.value) {
    case 'set': return 'Acción masiva: agregar / actualizar propiedades'
    case 'remove': return 'Acción masiva: eliminar propiedades'
    case 'delete-ids': return `Eliminar ${selectedIds.value.size} nodo(s) seleccionados`
    case 'delete-filter': return 'Eliminar nodos por filtro'
    default: return ''
  }
})

const filterSummary = computed(() => {
  const obj = whereObject()
  const entries = Object.entries(obj)
  return entries.length
    ? entries.map(([k, v]) => `${k} = ${v}`).join(' · ')
    : 'sin filtro (TODOS los nodos del label)'
})

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
        <div class="flex items-center gap-2 flex-wrap">
          <button class="btn-secondary text-xs" @click="openBulk('set')">
            ⚙ etiquetar selección
          </button>
          <button class="btn-secondary text-xs" @click="openBulk('remove')">
            ⌫ limpiar campo
          </button>
          <button
            class="btn-danger text-xs"
            :disabled="!selectedIds.size"
            @click="openBulk('delete-ids')"
          >
            🗑 eliminar selección ({{ selectedIds.size }})
          </button>
          <button class="btn-danger text-xs" @click="openBulk('delete-filter')">
            🗑 eliminar por filtro
          </button>
          <span class="w-px h-5 bg-slate-200 mx-1" />
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
              <th class="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  :checked="items.length > 0 && selectedIds.size === items.length"
                  @change="toggleAll"
                />
              </th>
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
              class="border-b border-slate-100 hover:bg-brand-50/40"
              :class="isSelected(item) ? 'bg-brand-50/60' : ''"
            >
              <td class="px-3 py-2 w-8" @click.stop>
                <input
                  type="checkbox"
                  :checked="isSelected(item)"
                  @change="toggleRow(item)"
                />
              </td>
              <td class="px-4 py-2 cursor-pointer" @click="openDetail(item)">
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
                class="px-4 py-2 text-slate-700 max-w-[280px] truncate cursor-pointer"
                @click="openDetail(item)"
              >
                <span v-if="col === idField" class="font-mono text-xs">
                  {{ formatPropValue(item.n.properties[col]) }}
                </span>
                <span v-else>{{ formatPropValue(item.n.properties[col]) }}</span>
              </td>
              <td class="px-4 py-2 text-right text-brand-600 text-xs cursor-pointer" @click="openDetail(item)">→</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bulk modal -->
    <Modal
      :open="bulkMode !== null"
      :title="bulkTitle"
      size="lg"
      @close="bulkMode = null"
    >
      <div class="space-y-4">
        <div
          v-if="bulkMode !== 'delete-ids'"
          class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm"
        >
          <div class="text-xs uppercase tracking-wider text-slate-500 mb-1">
            Filtro aplicado
          </div>
          <div class="font-mono text-slate-700">
            <span class="badge-info mr-2">{{ label }}</span>
            {{ filterSummary }}
          </div>
          <p class="text-xs text-slate-500 mt-2">
            Se aplica a TODOS los nodos que cumplen el filtro actual.
          </p>
        </div>

        <div v-if="bulkMode === 'set'">
          <h4 class="text-sm font-semibold text-slate-700 mb-2">Propiedades a aplicar</h4>
          <PropertyEditor v-model="bulkProps" />
        </div>

        <div v-else-if="bulkMode === 'remove'">
          <label class="label">Propiedades a eliminar (separadas por coma)</label>
          <input
            v-model="bulkRemoveNames"
            placeholder="ej. revisado, motivo_alerta"
            class="input"
          />
        </div>

        <div v-else-if="bulkMode === 'delete-ids'" class="space-y-3">
          <div class="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700">
            <strong>Acción destructiva.</strong> Se eliminarán definitivamente
            <strong>{{ selectedIds.size }}</strong> nodo(s) {{ label }}
            con todas sus relaciones (DETACH DELETE).
          </div>
          <div class="text-xs text-slate-500 max-h-32 overflow-y-auto font-mono space-y-0.5">
            <div v-for="id in Array.from(selectedIds)" :key="id">{{ id }}</div>
          </div>
        </div>

        <div v-else-if="bulkMode === 'delete-filter'" class="space-y-2">
          <div class="bg-rose-50 border border-rose-200 rounded-lg p-4 text-sm text-rose-700">
            <strong>Acción destructiva.</strong> Se eliminarán todos los nodos
            <strong>{{ label }}</strong> que cumplan el filtro mostrado arriba
            (DETACH DELETE).
          </div>
        </div>

        <div v-if="bulkError" class="text-sm text-rose-600">{{ bulkError }}</div>
        <div v-if="bulkResult" class="text-sm text-emerald-600">{{ bulkResult }}</div>
      </div>

      <template #footer>
        <button class="btn-secondary" :disabled="bulkBusy" @click="bulkMode = null">Cerrar</button>
        <button
          :class="bulkMode && bulkMode.startsWith('delete') ? 'btn-danger' : 'btn-primary'"
          :disabled="bulkBusy"
          @click="submitBulk"
        >
          {{ bulkBusy ? 'Aplicando…' : 'Aplicar' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
