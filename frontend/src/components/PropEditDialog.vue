<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import { PROP_TYPES, type PropType } from '@/api/schema'
import { coerceValue, defaultEntry, entriesToObject, type PropEntry } from '@/lib/coerce'
import PropertyEditor from './PropertyEditor.vue'
import { detectType } from '@/lib/props'

const props = defineProps<{
  open: boolean
  /** "single" → name+type+value (used to add or update one prop). "many" → multi-row editor. */
  mode: 'single' | 'many'
  /** Pre-filled props (only used in "single" mode). */
  initial?: { name?: string; value?: unknown }
  /** Lock the name field — used when editing an existing property. */
  lockName?: boolean
  title?: string
  submitLabel?: string
  busy?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'submit', payload: Record<string, unknown>): void
}>()

const name = ref('')
const type = ref<PropType>('string')
const value = ref('')
const entries = ref<PropEntry[]>([defaultEntry()])
const error = ref<string | null>(null)

watch(
  () => props.open,
  (v) => {
    if (!v) return
    error.value = null
    if (props.mode === 'single') {
      name.value = props.initial?.name ?? ''
      const init = props.initial?.value
      type.value = init != null ? (detectType(init) as PropType) : 'string'
      value.value = init == null ? '' : Array.isArray(init) ? init.join(', ') : String(init)
    } else {
      entries.value = [defaultEntry()]
    }
  },
  { immediate: true },
)

// Si el usuario cambia el tipo a boolean, defaulta a 'true' para que el
// select muestre el valor real (sin esto coerceValue('boolean', '') -> false
// y se actualizaba a false aunque visualmente decia true).
watch(type, (t) => {
  if (t === 'boolean' && value.value !== 'true' && value.value !== 'false') {
    value.value = 'true'
  }
})

const valid = computed(() => {
  if (props.mode === 'single') {
    return name.value.trim().length > 0
  }
  return entries.value.some((e) => e.name.trim().length > 0)
})

function submit() {
  error.value = null
  try {
    if (props.mode === 'single') {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name.value)) {
        throw new Error(`Nombre de propiedad inválido: "${name.value}"`)
      }
      emit('submit', { [name.value]: coerceValue(type.value, value.value) })
    } else {
      emit('submit', entriesToObject(entries.value))
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error en los valores'
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="title || (mode === 'single' ? 'Editar propiedad' : 'Agregar propiedades')"
    :size="mode === 'many' ? 'lg' : 'sm'"
    @close="emit('close')"
  >
    <div v-if="mode === 'single'" class="space-y-3">
      <div>
        <label class="label">Propiedad</label>
        <input
          v-model="name"
          :readonly="lockName"
          :class="['input', lockName ? 'bg-slate-50 text-slate-500' : '']"
          placeholder="ej. score_risk"
        />
      </div>
      <div>
        <label class="label">Tipo</label>
        <select v-model="type" class="input">
          <option v-for="t in PROP_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>
      <div>
        <label class="label">Valor</label>
        <select v-if="type === 'boolean'" v-model="value" class="input">
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
        <input
          v-else
          v-model="value"
          :type="
            type === 'integer' || type === 'float' ? 'number'
            : type === 'date' ? 'date'
            : type === 'datetime' ? 'datetime-local'
            : 'text'
          "
          :step="type === 'float' ? 'any' : undefined"
          :placeholder="type === 'list' ? 'a, b, c' : 'valor'"
          class="input"
        />
      </div>
    </div>

    <div v-else>
      <PropertyEditor v-model="entries" />
    </div>

    <div v-if="error" class="text-sm text-rose-600 mt-3">{{ error }}</div>

    <template #footer>
      <button class="btn-secondary" :disabled="busy" @click="emit('close')">Cancelar</button>
      <button class="btn-primary" :disabled="!valid || busy" @click="submit">
        {{ busy ? 'Guardando…' : (submitLabel || 'Guardar') }}
      </button>
    </template>
  </Modal>
</template>
