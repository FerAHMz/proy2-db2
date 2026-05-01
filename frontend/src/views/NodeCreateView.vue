<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { nodesApi } from '@/api/nodes'
import {
  ALLOWED_SECONDARIES,
  ID_FIELD,
  type PrimaryLabel,
  type SecondaryLabel,
} from '@/api/schema'
import PropertyEditor from '@/components/PropertyEditor.vue'
import { defaultEntry, entriesToObject, type PropEntry } from '@/lib/coerce'

const router = useRouter()

type Mode = 'single' | 'multi'
const mode = ref<Mode>('single')

const SINGLE_ELIGIBLE: PrimaryLabel[] = [
  'Comercio', 'Tarjeta', 'Dispositivo', 'Ubicacion', 'AlertaFraude', 'Transaccion',
]
const MULTI_ELIGIBLE: PrimaryLabel[] = ['Cliente', 'Cuenta']

const labelSingle = ref<PrimaryLabel>('Comercio')
const labelMulti = ref<PrimaryLabel>('Cliente')
const selectedSecondaries = ref<SecondaryLabel[]>(['VIP'])

const props = ref<PropEntry[]>(seed(labelSingle.value))

function seed(label: PrimaryLabel): PropEntry[] {
  return [
    { name: ID_FIELD[label], type: 'string', value: '' },
    defaultEntry(),
    defaultEntry(),
    defaultEntry(),
    defaultEntry(),
  ]
}

watch(mode, (m) => {
  props.value = seed(m === 'single' ? labelSingle.value : labelMulti.value)
})
watch(labelSingle, (l) => {
  if (mode.value === 'single') props.value = seed(l)
})
watch(labelMulti, (l) => {
  if (mode.value === 'multi') {
    props.value = seed(l)
    selectedSecondaries.value = ALLOWED_SECONDARIES[l].slice(0, 1)
  }
})

const validCount = computed(
  () => props.value.filter((e) => e.name.trim().length > 0).length,
)
const canSubmit = computed(() => {
  if (validCount.value < 5) return false
  if (mode.value === 'multi' && selectedSecondaries.value.length < 1) return false
  const idField = mode.value === 'single' ? ID_FIELD[labelSingle.value] : ID_FIELD[labelMulti.value]
  const idEntry = props.value.find((e) => e.name === idField)
  if (!idEntry?.value) return false
  return true
})

const submitting = ref(false)
const error = ref<string | null>(null)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = null
  try {
    const payload = entriesToObject(props.value)
    if (mode.value === 'single') {
      await nodesApi.createSingle(labelSingle.value, payload)
      const id = String(payload[ID_FIELD[labelSingle.value]])
      router.push({ name: 'nodos.detail', params: { label: labelSingle.value, id } })
    } else {
      const labels: string[] = [labelMulti.value, ...selectedSecondaries.value]
      await nodesApi.createMulti(labels, payload)
      const id = String(payload[ID_FIELD[labelMulti.value]])
      router.push({ name: 'nodos.detail', params: { label: labelMulti.value, id } })
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al crear el nodo'
  } finally {
    submitting.value = false
  }
}

function toggleSecondary(s: SecondaryLabel) {
  const i = selectedSecondaries.value.indexOf(s)
  if (i >= 0) selectedSecondaries.value.splice(i, 1)
  else selectedSecondaries.value.push(s)
}

const currentLabel = computed(() =>
  mode.value === 'single' ? labelSingle.value : labelMulti.value,
)
const idField = computed(() => ID_FIELD[currentLabel.value])
</script>

<template>
  <div class="max-w-3xl space-y-5">
    <div>
      <h2 class="text-lg font-semibold text-slate-900">Crear nodo</h2>
      <p class="text-sm text-slate-500">
        Cubre los items de creación de la rúbrica: 1 label, 2+ labels y ≥5 propiedades.
      </p>
    </div>

    <!-- Mode tabs -->
    <div class="inline-flex rounded-lg border border-slate-200 bg-white p-1">
      <button
        :class="['px-4 py-1.5 text-sm rounded-md transition',
                  mode === 'single' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50']"
        @click="mode = 'single'"
      >
        Entidad simple (1 label)
      </button>
      <button
        :class="['px-4 py-1.5 text-sm rounded-md transition',
                  mode === 'multi' ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-50']"
        @click="mode = 'multi'"
      >
        Cliente / Cuenta segmentado (2+ labels)
      </button>
    </div>

    <div class="card">
      <div class="card-body space-y-4">
        <!-- Single mode -->
        <div v-if="mode === 'single'" class="space-y-3">
          <div>
            <label class="label">Label primaria</label>
            <select v-model="labelSingle" class="input max-w-xs">
              <option v-for="l in SINGLE_ELIGIBLE" :key="l" :value="l">{{ l }}</option>
            </select>
            <p class="text-xs text-slate-500 mt-1">
              Endpoint: <code>POST /api/nodes/single-label</code>
            </p>
          </div>
        </div>

        <!-- Multi mode -->
        <div v-else class="space-y-3">
          <div>
            <label class="label">Label primaria</label>
            <select v-model="labelMulti" class="input max-w-xs">
              <option v-for="l in MULTI_ELIGIBLE" :key="l" :value="l">{{ l }}</option>
            </select>
          </div>
          <div>
            <label class="label">Labels secundarias (≥1)</label>
            <div class="flex flex-wrap gap-2">
              <label
                v-for="s in ALLOWED_SECONDARIES[labelMulti]"
                :key="s"
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition"
                :class="
                  selectedSecondaries.includes(s)
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-slate-200 hover:border-slate-300'
                "
              >
                <input
                  type="checkbox"
                  :checked="selectedSecondaries.includes(s)"
                  class="hidden"
                  @change="toggleSecondary(s)"
                />
                {{ s }}
              </label>
            </div>
            <p class="text-xs text-slate-500 mt-1">
              Endpoint: <code>POST /api/nodes/multi-label</code> ·
              labels enviados:
              <code class="ml-1">{{ [labelMulti, ...selectedSecondaries].join(':') }}</code>
            </p>
          </div>
        </div>

        <hr class="border-slate-200" />

        <div>
          <h3 class="text-sm font-semibold text-slate-700 mb-2">
            Propiedades
            <span class="text-xs text-slate-400 font-normal">
              · {{ idField }} es el id obligatorio
            </span>
          </h3>
          <PropertyEditor v-model="props" :min-props="5" :required-key="idField" />
        </div>

        <div v-if="error" class="text-sm text-rose-600">{{ error }}</div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <RouterLink :to="{ name: 'nodos' }" class="btn-secondary">Cancelar</RouterLink>
          <button class="btn-primary" :disabled="!canSubmit || submitting" @click="submit">
            {{ submitting ? 'Guardando…' : 'Crear nodo' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
