<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { REL_TYPES, type RelType } from '@/api/schema'
import { relationshipsApi, type RelData } from '@/api/relationships'
import { formatPropValue } from '@/lib/props'
import Modal from '@/components/Modal.vue'
import PropertyEditor from '@/components/PropertyEditor.vue'
import { defaultEntry, entriesToObject, type PropEntry } from '@/lib/coerce'

const relType = ref<RelType>('POSEE')
const items = ref<RelData[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const limit = ref(50)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await relationshipsApi.list(relType.value, limit.value)
    items.value = res.items
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al consultar'
  } finally {
    loading.value = false
  }
}

watch(relType, load)
onMounted(load)

// === Bulk filter ===
const filterRows = reactive<{ key: string; value: string }[]>([
  { key: '', value: '' },
])
function addFilter() { filterRows.push({ key: '', value: '' }) }
function removeFilter(i: number) {
  filterRows.splice(i, 1)
  if (!filterRows.length) filterRows.push({ key: '', value: '' })
}
function filterObj(): Record<string, string> {
  const o: Record<string, string> = {}
  for (const r of filterRows) if (r.key && r.value) o[r.key] = r.value
  return o
}
const filterSummary = computed(() => {
  const o = filterObj()
  const e = Object.entries(o)
  return e.length ? e.map(([k, v]) => `${k} = ${v}`).join(' · ') : 'sin filtro (TODAS las rels del tipo)'
})

// === Bulk modal ===
type Action = 'set' | 'remove' | null
const action = ref<Action>(null)
const setProps = ref<PropEntry[]>([defaultEntry()])
const removeNames = ref('')
const busy = ref(false)
const result = ref<string | null>(null)
const opError = ref<string | null>(null)

function openAction(a: Action) {
  action.value = a
  setProps.value = [defaultEntry()]
  removeNames.value = ''
  result.value = null
  opError.value = null
}

async function applyBulk() {
  busy.value = true
  result.value = null
  opError.value = null
  try {
    const f = filterObj()
    if (action.value === 'set') {
      const res = await relationshipsApi.patchPropsBulk(relType.value, f, entriesToObject(setProps.value))
      result.value = `${res.updated} relación(es) actualizadas.`
    } else if (action.value === 'remove') {
      const names = removeNames.value.split(',').map((s) => s.trim()).filter(Boolean)
      if (!names.length) throw new Error('Indica al menos un nombre de propiedad')
      const res = await relationshipsApi.removePropsBulk(relType.value, f, names)
      result.value = `${res.updated} relación(es) actualizadas.`
    }
    await load()
  } catch (e: unknown) {
    opError.value = e instanceof Error ? e.message : 'Error en la operación masiva'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="space-y-5">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Auditoría de relaciones</h2>
      <p class="text-sm text-slate-500">
        Inspecciona y aplica acciones masivas sobre las propiedades de las relaciones.
      </p>
    </div>

    <div class="card">
      <div class="card-body grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="label">Tipo de relación</label>
          <select v-model="relType" class="input">
            <option v-for="t in REL_TYPES" :key="t" :value="t">{{ t }}</option>
          </select>
        </div>
        <div>
          <label class="label">Limit</label>
          <select v-model="limit" class="input" @change="load">
            <option :value="20">20</option>
            <option :value="50">50</option>
            <option :value="100">100</option>
            <option :value="200">200</option>
          </select>
        </div>
        <div class="flex items-end">
          <button class="btn-secondary w-full" @click="load">↻ Recargar</button>
        </div>
      </div>
    </div>

    <!-- Filter -->
    <div class="card">
      <div class="card-body space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-700">
            Filtro para acciones masivas
          </h3>
          <span class="text-xs text-slate-400">
            propiedades de la relación (igualdad exacta sobre <code class="text-[11px]">r.k</code>)
          </span>
        </div>
        <div
          v-for="(row, i) in filterRows"
          :key="i"
          class="grid grid-cols-[1fr_1fr_auto] gap-2 items-end"
        >
          <input v-model="row.key" placeholder="propiedad" class="input" />
          <input v-model="row.value" placeholder="valor" class="input" />
          <button class="btn-secondary text-xs px-2" @click="removeFilter(i)">×</button>
        </div>
        <div class="flex items-center gap-2">
          <button class="btn-secondary text-xs" @click="addFilter">+ filtro</button>
          <span class="w-px h-5 bg-slate-200 mx-1" />
          <button class="btn-primary text-xs" @click="openAction('set')">
            ⚙ agregar / actualizar props
          </button>
          <button class="btn-secondary text-xs" @click="openAction('remove')">
            ⌫ eliminar props
          </button>
        </div>
      </div>
    </div>

    <!-- List -->
    <div class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">
          Relaciones <code class="text-xs">{{ relType }}</code>
        </h3>
        <span class="badge-muted">{{ items.length }} mostradas</span>
      </div>
      <div class="card-body p-0 overflow-x-auto">
        <div v-if="loading" class="p-5 text-sm text-slate-400">Cargando…</div>
        <div v-else-if="error" class="p-5 text-sm text-rose-600">{{ error }}</div>
        <div v-else-if="!items.length" class="p-5 text-sm text-slate-400">Sin relaciones.</div>
        <table v-else class="min-w-full text-sm">
          <thead class="bg-slate-50 border-b">
            <tr>
              <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">A</th>
              <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">→</th>
              <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">B</th>
              <th class="px-4 py-2 text-left text-xs uppercase tracking-wider text-slate-500">Propiedades</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in items" :key="r.relId" class="border-b border-slate-100 hover:bg-slate-50">
              <td class="px-4 py-2">
                <div class="flex flex-wrap items-center gap-1">
                  <span v-for="l in r.labelsA" :key="l" class="badge-muted text-[10px]">{{ l }}</span>
                </div>
                <div class="font-mono text-xs text-slate-700 mt-0.5">
                  {{ Object.values(r.a.properties)[0] }}
                </div>
              </td>
              <td class="px-4 py-2 text-slate-400 text-center">→</td>
              <td class="px-4 py-2">
                <div class="flex flex-wrap items-center gap-1">
                  <span v-for="l in r.labelsB" :key="l" class="badge-muted text-[10px]">{{ l }}</span>
                </div>
                <div class="font-mono text-xs text-slate-700 mt-0.5">
                  {{ Object.values(r.b.properties)[0] }}
                </div>
              </td>
              <td class="px-4 py-2 text-xs text-slate-600">
                <div v-for="(v, k) in r.props" :key="k" class="font-mono">
                  <span class="text-slate-400">{{ k }}:</span> {{ formatPropValue(v as never) }}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Bulk modal -->
    <Modal
      :open="action !== null"
      :title="action === 'set' ? 'Bulk: agregar / actualizar props' : 'Bulk: eliminar props'"
      size="lg"
      @close="action = null"
    >
      <div class="space-y-4">
        <div class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
          <div class="text-xs uppercase tracking-wider text-slate-500 mb-1">Filtro</div>
          <div class="font-mono text-slate-700">
            <span class="badge-info mr-2">{{ relType }}</span>
            {{ filterSummary }}
          </div>
        </div>

        <div v-if="action === 'set'">
          <h4 class="text-sm font-semibold text-slate-700 mb-2">Propiedades a aplicar</h4>
          <PropertyEditor v-model="setProps" />
        </div>

        <div v-else>
          <label class="label">Propiedades a eliminar (separadas por coma)</label>
          <input v-model="removeNames" placeholder="ej. revisado_por, fecha_revision" class="input" />
        </div>

        <div v-if="opError" class="text-sm text-rose-600">{{ opError }}</div>
        <div v-if="result" class="text-sm text-emerald-600">{{ result }}</div>
      </div>

      <template #footer>
        <button class="btn-secondary" :disabled="busy" @click="action = null">Cerrar</button>
        <button class="btn-primary" :disabled="busy" @click="applyBulk">
          {{ busy ? 'Aplicando…' : 'Aplicar' }}
        </button>
      </template>
    </Modal>
  </div>
</template>
