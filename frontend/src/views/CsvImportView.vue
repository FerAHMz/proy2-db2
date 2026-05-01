<script setup lang="ts">
import { computed, ref } from 'vue'
import Papa from 'papaparse'
import {
  ALLOWED_SECONDARIES,
  ID_FIELD,
  PRIMARY_LABELS,
  PROP_TYPES,
  REL_TYPES,
  type PrimaryLabel,
  type PropType,
  type RelType,
  type SecondaryLabel,
} from '@/api/schema'
import { detectType } from '@/lib/props'
import { uploadCsv, type CsvConfig, type CsvUploadResult } from '@/api/csv'
import { useToasts } from '@/stores/toasts'

const toasts = useToasts()

type Mode = 'nodes' | 'relationships'

interface MappingState {
  property: string
  type: PropType
  include: boolean
}

const file = ref<File | null>(null)
const headers = ref<string[]>([])
const previewRows = ref<Record<string, string>[]>([])
const mode = ref<Mode>('nodes')

// nodes config
const nodeLabel = ref<PrimaryLabel>('Cliente')
const matchKey = ref('')
const secondaryLabels = ref<SecondaryLabel[]>([])

// relationships config
const relType = ref<RelType>('POSEE')
const fromLabel = ref<PrimaryLabel>('Cliente')
const fromKey = ref('')
const toLabel = ref<PrimaryLabel>('Cuenta')
const toKey = ref('')

const mappings = ref<Record<string, MappingState>>({})
const dragOver = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const result = ref<CsvUploadResult | null>(null)

function onDrop(ev: DragEvent) {
  dragOver.value = false
  const f = ev.dataTransfer?.files?.[0]
  if (f) handleFile(f)
}

function onPick(ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (f) handleFile(f)
}

function handleFile(f: File) {
  if (!/\.(csv|txt)$/i.test(f.name)) {
    error.value = 'El archivo debe ser .csv'
    return
  }
  file.value = f
  error.value = null
  result.value = null
  Papa.parse(f, {
    header: true,
    skipEmptyLines: true,
    preview: 6,
    complete: (res) => {
      headers.value = res.meta.fields ?? []
      previewRows.value = res.data as Record<string, string>[]
      // initialize mappings
      const m: Record<string, MappingState> = {}
      for (const col of headers.value) {
        const sample = previewRows.value[0]?.[col]
        m[col] = {
          property: col,
          type: (detectType(sample) as PropType) ?? 'string',
          include: true,
        }
      }
      mappings.value = m
      // suggest matchKey for nodes mode
      if (!matchKey.value) {
        const idLike = headers.value.find(
          (h) => h === ID_FIELD[nodeLabel.value] || /_id$/.test(h),
        )
        if (idLike) matchKey.value = idLike
      }
      if (!fromKey.value) fromKey.value = headers.value[0] || ''
      if (!toKey.value) toKey.value = headers.value[1] || ''
    },
    error: (err) => {
      error.value = `Error al parsear CSV: ${err.message}`
    },
  })
}

function clearFile() {
  file.value = null
  headers.value = []
  previewRows.value = []
  mappings.value = {}
  result.value = null
  error.value = null
}

function toggleSecondary(s: SecondaryLabel) {
  const i = secondaryLabels.value.indexOf(s)
  if (i >= 0) secondaryLabels.value.splice(i, 1)
  else secondaryLabels.value.push(s)
}

const builtConfig = computed<CsvConfig | null>(() => {
  if (!headers.value.length) return null
  const m: Record<string, { property: string; type: PropType }> = {}
  for (const [col, spec] of Object.entries(mappings.value)) {
    if (!spec.include) continue
    if (!spec.property) continue
    m[col] = { property: spec.property, type: spec.type }
  }
  if (mode.value === 'nodes') {
    if (!matchKey.value) return null
    return {
      mode: 'nodes',
      label: nodeLabel.value,
      matchKey: matchKey.value,
      secondaryLabels: secondaryLabels.value.length ? secondaryLabels.value : undefined,
      mappings: m,
    }
  }
  if (!fromKey.value || !toKey.value) return null
  return {
    mode: 'relationships',
    type: relType.value,
    fromLabel: fromLabel.value,
    fromKey: fromKey.value,
    toLabel: toLabel.value,
    toKey: toKey.value,
    mappings: m,
  }
})

const canSubmit = computed(() => !!file.value && !!builtConfig.value && !submitting.value)

async function submit() {
  if (!file.value || !builtConfig.value) return
  submitting.value = true
  error.value = null
  result.value = null
  try {
    const r = await uploadCsv(file.value, builtConfig.value)
    result.value = r
    toasts.success(`CSV cargado: ${r.upserted} ${mode.value === 'nodes' ? 'nodos' : 'relaciones'}`)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al cargar el CSV'
    error.value = msg
    toasts.error(msg)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="space-y-5 max-w-6xl">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Importar CSV</h2>
      <p class="text-sm text-slate-500">
        Drag & drop, mapeo por columna y carga directa al grafo
        (<code>POST /api/csv/upload</code>).
      </p>
    </div>

    <!-- Drop zone -->
    <div
      v-if="!file"
      :class="[
        'card border-2 border-dashed transition-colors text-center py-12',
        dragOver ? 'border-brand-500 bg-brand-50' : 'border-slate-300',
      ]"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <h3 class="text-lg font-semibold text-slate-900">
        Arrastra un archivo CSV aquí
      </h3>
      <p class="text-sm text-slate-500 mt-1">o</p>
      <label class="btn-primary mt-3 inline-flex cursor-pointer">
        Seleccionar archivo
        <input type="file" accept=".csv,.txt" class="hidden" @change="onPick" />
      </label>
      <p class="text-xs text-slate-400 mt-3">Hasta 10 MB</p>
    </div>

    <!-- Loaded -->
    <template v-else>
      <div class="card card-body flex items-center justify-between">
        <div>
          <div class="font-semibold text-slate-900">{{ file.name }}</div>
          <div class="text-xs text-slate-500">
            {{ headers.length }} columnas · preview {{ previewRows.length }} filas
          </div>
        </div>
        <button class="btn-secondary" @click="clearFile">Cambiar archivo</button>
      </div>

      <!-- Preview -->
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900">Preview</h3>
        </div>
        <div class="card-body p-0 overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th
                  v-for="h in headers"
                  :key="h"
                  class="px-3 py-2 text-left font-mono text-slate-600 whitespace-nowrap"
                >
                  {{ h }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, i) in previewRows"
                :key="i"
                class="border-b border-slate-100"
              >
                <td
                  v-for="h in headers"
                  :key="h"
                  class="px-3 py-1.5 text-slate-700 max-w-[180px] truncate"
                >
                  {{ row[h] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Mode + config -->
      <div class="card">
        <div class="card-body space-y-4">
          <div>
            <h3 class="text-sm font-semibold text-slate-700 mb-2">Modo</h3>
            <div class="inline-flex rounded-lg border border-slate-200 bg-white p-1">
              <button
                :class="['px-4 py-1.5 text-sm rounded-md transition',
                          mode === 'nodes' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50']"
                @click="mode = 'nodes'"
              >
                Cargar nodos
              </button>
              <button
                :class="['px-4 py-1.5 text-sm rounded-md transition',
                          mode === 'relationships' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50']"
                @click="mode = 'relationships'"
              >
                Cargar relaciones
              </button>
            </div>
          </div>

          <!-- Nodes config -->
          <div v-if="mode === 'nodes'" class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="label">Label primaria</label>
              <select v-model="nodeLabel" class="input">
                <option v-for="l in PRIMARY_LABELS" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>
            <div>
              <label class="label">Match key (columna del CSV)</label>
              <select v-model="matchKey" class="input">
                <option value="">— seleccionar —</option>
                <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
              </select>
              <p class="text-[11px] text-slate-500 mt-1">
                Default sugerido: <code>{{ ID_FIELD[nodeLabel] }}</code>
              </p>
            </div>
            <div v-if="ALLOWED_SECONDARIES[nodeLabel].length">
              <label class="label">Labels secundarias</label>
              <div class="flex flex-wrap gap-1.5">
                <label
                  v-for="s in ALLOWED_SECONDARIES[nodeLabel]"
                  :key="s"
                  class="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs cursor-pointer transition"
                  :class="
                    secondaryLabels.includes(s)
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200'
                  "
                >
                  <input
                    type="checkbox"
                    :checked="secondaryLabels.includes(s)"
                    class="hidden"
                    @change="toggleSecondary(s)"
                  />
                  {{ s }}
                </label>
              </div>
            </div>
          </div>

          <!-- Relationships config -->
          <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="label">Tipo de relación</label>
              <select v-model="relType" class="input">
                <option v-for="t in REL_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div class="md:col-span-1">
              <label class="label">From — label</label>
              <select v-model="fromLabel" class="input">
                <option v-for="l in PRIMARY_LABELS" :key="l" :value="l">{{ l }}</option>
              </select>
              <label class="label mt-2">Columna fromKey</label>
              <select v-model="fromKey" class="input">
                <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
            <div class="md:col-span-1">
              <label class="label">To — label</label>
              <select v-model="toLabel" class="input">
                <option v-for="l in PRIMARY_LABELS" :key="l" :value="l">{{ l }}</option>
              </select>
              <label class="label mt-2">Columna toKey</label>
              <select v-model="toKey" class="input">
                <option v-for="h in headers" :key="h" :value="h">{{ h }}</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <!-- Mappings -->
      <div class="card">
        <div class="card-header">
          <h3 class="font-semibold text-slate-900">Mapeo de columnas</h3>
        </div>
        <div class="card-body p-0 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 border-b">
              <tr>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-500 w-16">
                  Incl.
                </th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Columna CSV
                </th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Propiedad Neo4j
                </th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Tipo
                </th>
                <th class="px-3 py-2 text-left text-xs uppercase tracking-wider text-slate-500">
                  Muestra
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="h in headers" :key="h" class="border-b border-slate-100">
                <td class="px-3 py-2">
                  <input v-model="mappings[h].include" type="checkbox" />
                </td>
                <td class="px-3 py-2 font-mono text-xs text-slate-700">{{ h }}</td>
                <td class="px-3 py-2">
                  <input v-model="mappings[h].property" class="input text-sm py-1" />
                </td>
                <td class="px-3 py-2">
                  <select v-model="mappings[h].type" class="input text-sm py-1 w-32">
                    <option v-for="t in PROP_TYPES" :key="t" :value="t">{{ t }}</option>
                  </select>
                </td>
                <td class="px-3 py-2 font-mono text-xs text-slate-500 max-w-[220px] truncate">
                  {{ previewRows[0]?.[h] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Result + submit -->
      <div class="card card-body flex items-center justify-between gap-4">
        <div class="text-sm">
          <div v-if="error" class="text-rose-600">{{ error }}</div>
          <div v-else-if="result" class="text-emerald-600">
            Cargado: <strong>{{ result.upserted }}</strong>
            {{ mode === 'nodes' ? 'nodos upserted' : 'relaciones upserted' }}
            de {{ result.rows_in_csv }} fila(s) en el CSV.
          </div>
          <div v-else class="text-slate-500">
            Listo para cargar
            {{ mode === 'nodes' ? `como nodos ${nodeLabel}` : `como relaciones ${relType}` }}.
          </div>
        </div>
        <button class="btn-primary" :disabled="!canSubmit" @click="submit">
          {{ submitting ? 'Subiendo…' : 'Cargar CSV' }}
        </button>
      </div>
    </template>
  </div>
</template>
