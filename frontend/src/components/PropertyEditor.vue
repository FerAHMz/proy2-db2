<script setup lang="ts">
import { computed } from 'vue'
import { PROP_TYPES } from '@/api/schema'
import { defaultEntry, type PropEntry } from '@/lib/coerce'

const props = defineProps<{
  modelValue: PropEntry[]
  /** Mínimo requerido para validación (mostrado al usuario). Default 0. */
  minProps?: number
  /** Si se setea, marca este nombre como readonly y "obligatorio" en la UI. */
  requiredKey?: string
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

const validCount = computed(
  () => list.value.filter((e) => e.name.trim().length > 0).length,
)

const meetsMin = computed(() =>
  props.minProps ? validCount.value >= props.minProps : true,
)
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
        @change="(e) => update(i, { type: (e.target as HTMLSelectElement).value as PropEntry['type'], value: '' })"
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
