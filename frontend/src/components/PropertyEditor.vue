<script setup lang="ts">
import { computed } from 'vue'
import { PROP_TYPES, type PropType } from '@/api/schema'
import { defaultEntry, type PropEntry } from '@/lib/coerce'

export interface PropSuggestion {
  name: string
  type: PropType
  /** Cuántas veces aparece esta propiedad en la muestra cargada. */
  count?: number
}

const props = defineProps<{
  modelValue: PropEntry[]
  /** Mínimo requerido para validación (mostrado al usuario). Default 0. */
  minProps?: number
  /** Si se setea, marca este nombre como readonly y "obligatorio" en la UI. */
  requiredKey?: string
  /** Propiedades existentes en los datos: aparecen como chips clickeables. */
  suggestions?: PropSuggestion[]
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: PropEntry[]): void
}>()

const list = computed({
  get: () => props.modelValue,
  set: (v: PropEntry[]) => emit('update:modelValue', v),
})

function add() {
  list.value = [...list.value, defaultEntry()]
}
function remove(i: number) {
  const next = list.value.slice()
  next.splice(i, 1)
  list.value = next.length ? next : [defaultEntry()]
}
function update(i: number, patch: Partial<PropEntry>) {
  const next = list.value.slice()
  next[i] = { ...next[i], ...patch }
  list.value = next
}

// boolean necesita valor explicito ('true'/'false') porque coerceValue
// trata cualquier otro string como false. Sin esto, los chips de boolean
// se enviaban como false aunque el select mostrara "true" visualmente.
function defaultValueFor(type: PropType): string {
  return type === 'boolean' ? 'true' : ''
}

function pickSuggestion(s: PropSuggestion) {
  // Si ya hay una fila vacía, llénala. Si no, agrega una nueva.
  const empty = list.value.findIndex((e) => !e.name.trim())
  const entry: PropEntry = { name: s.name, type: s.type, value: defaultValueFor(s.type) }
  if (empty >= 0) {
    update(empty, entry)
  } else {
    list.value = [...list.value, entry]
  }
}

function changeType(i: number, newType: PropType) {
  update(i, { type: newType, value: defaultValueFor(newType) })
}

const validCount = computed(
  () => list.value.filter((e) => e.name.trim().length > 0).length,
)

const meetsMin = computed(() =>
  props.minProps ? validCount.value >= props.minProps : true,
)

function isUsed(name: string) {
  return list.value.some((e) => e.name === name)
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="minProps" class="flex items-center justify-between text-xs">
      <span class="text-slate-500">
        Propiedades válidas:
        <span class="font-semibold" :class="meetsMin ? 'text-emerald-600' : 'text-amber-600'">
          {{ validCount }} / {{ minProps }}
        </span>
      </span>
      <span v-if="!meetsMin" class="text-amber-600">
        Faltan {{ minProps - validCount }} para habilitar guardar.
      </span>
    </div>

    <div v-if="suggestions && suggestions.length" class="space-y-1.5">
      <div class="text-xs text-slate-500">
        Propiedades existentes en los datos cargados (click para precargar):
      </div>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="s in suggestions"
          :key="s.name"
          type="button"
          :disabled="isUsed(s.name)"
          :class="[
            'inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition',
            isUsed(s.name)
              ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50 text-slate-700',
          ]"
          @click="pickSuggestion(s)"
        >
          <span class="font-mono">{{ s.name }}</span>
          <span class="text-[10px] text-slate-400">{{ s.type }}</span>
        </button>
      </div>
    </div>

    <div
      v-for="(row, i) in list"
      :key="i"
      class="grid grid-cols-[2fr_1.2fr_3fr_auto] gap-2 items-center"
    >
      <input
        :value="row.name"
        :readonly="requiredKey === row.name"
        :class="['input text-sm', requiredKey === row.name ? 'bg-slate-50 text-slate-500' : '']"
        placeholder="propiedad (ej. nombre)"
        @input="(e) => update(i, { name: (e.target as HTMLInputElement).value })"
      />
      <select
        :value="row.type"
        class="input text-sm"
        @change="(e) => changeType(i, (e.target as HTMLSelectElement).value as PropType)"
      >
        <option v-for="t in PROP_TYPES" :key="t" :value="t">{{ t }}</option>
      </select>

      <!-- Value input by type -->
      <select
        v-if="row.type === 'boolean'"
        :value="row.value || 'true'"
        class="input text-sm"
        @change="(e) => update(i, { value: (e.target as HTMLSelectElement).value })"
      >
        <option value="true">true</option>
        <option value="false">false</option>
      </select>
      <input
        v-else
        :value="row.value"
        :type="
          row.type === 'integer' || row.type === 'float' ? 'number'
          : row.type === 'date' ? 'date'
          : row.type === 'datetime' ? 'datetime-local'
          : 'text'
        "
        :step="row.type === 'float' ? 'any' : undefined"
        :placeholder="
          row.type === 'list' ? 'a, b, c (separado por coma)'
          : row.type === 'datetime' ? 'YYYY-MM-DDTHH:mm:ss'
          : 'valor'
        "
        class="input text-sm"
        @input="(e) => update(i, { value: (e.target as HTMLInputElement).value })"
      />
      <button class="btn-secondary text-xs" @click="remove(i)">Quitar</button>
    </div>

    <button class="btn-secondary text-xs" @click="add">Agregar propiedad</button>
  </div>
</template>
