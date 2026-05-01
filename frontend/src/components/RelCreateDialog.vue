<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import PropertyEditor from './PropertyEditor.vue'
import { ID_FIELD, PRIMARY_LABELS, REL_TYPES, type PrimaryLabel, type RelType } from '@/api/schema'
import { defaultEntry, entriesToObject, type PropEntry } from '@/lib/coerce'
import { relationshipsApi } from '@/api/relationships'

const props = defineProps<{
  open: boolean
  /** Origin pre-fill (used when invoked from a node detail). */
  fromLabel?: PrimaryLabel
  fromId?: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'created'): void
}>()

const fromLabel = ref<PrimaryLabel>('Cliente')
const fromId = ref('')
const toLabel = ref<PrimaryLabel>('Cuenta')
const toId = ref('')
const relType = ref<RelType>('POSEE')
const props2 = ref<PropEntry[]>([defaultEntry(), defaultEntry(), defaultEntry()])
const busy = ref(false)
const error = ref<string | null>(null)

watch(
  () => props.open,
  (v) => {
    if (!v) return
    error.value = null
    fromLabel.value = props.fromLabel ?? 'Cliente'
    fromId.value = props.fromId ?? ''
    toLabel.value = 'Cuenta'
    toId.value = ''
    relType.value = 'POSEE'
    props2.value = [defaultEntry(), defaultEntry(), defaultEntry()]
  },
  { immediate: true },
)

const validProps = computed(
  () => props2.value.filter((e) => e.name.trim().length > 0).length,
)
const canSubmit = computed(
  () => validProps.value >= 3 && fromId.value && toId.value && relType.value,
)

async function submit() {
  if (!canSubmit.value) return
  busy.value = true
  error.value = null
  try {
    const properties = entriesToObject(props2.value)
    await relationshipsApi.create(
      { label: fromLabel.value, id: fromId.value },
      { label: toLabel.value, id: toId.value },
      relType.value,
      properties,
    )
    emit('created')
    emit('close')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al crear la relación'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Modal :open="open" title="Vincular entidades" size="lg" @close="emit('close')">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="label">Origen — label</label>
          <select v-model="fromLabel" class="input">
            <option v-for="l in PRIMARY_LABELS" :key="l" :value="l">{{ l }}</option>
          </select>
          <label class="label mt-2">{{ ID_FIELD[fromLabel] }}</label>
          <input v-model="fromId" placeholder="ej. CLI-00001" class="input font-mono text-sm" />
        </div>
        <div>
          <label class="label">Destino — label</label>
          <select v-model="toLabel" class="input">
            <option v-for="l in PRIMARY_LABELS" :key="l" :value="l">{{ l }}</option>
          </select>
          <label class="label mt-2">{{ ID_FIELD[toLabel] }}</label>
          <input v-model="toId" placeholder="ej. CTA-00001" class="input font-mono text-sm" />
        </div>
      </div>

      <div>
        <label class="label">Tipo de relación</label>
        <select v-model="relType" class="input max-w-xs">
          <option v-for="t in REL_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>
      </div>

      <div>
        <h4 class="text-sm font-semibold text-slate-700 mb-2">
          Propiedades
          <span class="text-xs text-slate-500 font-normal">
            (la rúbrica exige ≥3 — actualmente
            <span :class="validProps >= 3 ? 'text-emerald-600' : 'text-amber-600'">
              {{ validProps }}
            </span>)
          </span>
        </h4>
        <PropertyEditor v-model="props2" :min-props="3" />
      </div>

      <div v-if="error" class="text-sm text-rose-600">{{ error }}</div>
    </div>

    <template #footer>
      <button class="btn-secondary" :disabled="busy" @click="emit('close')">Cancelar</button>
      <button class="btn-primary" :disabled="!canSubmit || busy" @click="submit">
        {{ busy ? 'Creando…' : 'Vincular' }}
      </button>
    </template>
  </Modal>
</template>
