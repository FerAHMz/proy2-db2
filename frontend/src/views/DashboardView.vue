<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import {
  analyticsApi,
  type AnilloSospechoso,
  type ComercioConAlertas,
  type DispositivoCompartido,
  type PathClientes,
  type ResumenGrafo,
  type TopClienteMonto,
  type TxPaisRiesgo,
  type TxPorCanal,
} from '@/api/analytics'
import QueryCard from '@/components/QueryCard.vue'
import BarChart from '@/components/BarChart.vue'
import Modal from '@/components/Modal.vue'
import { fmtMoney, fmtNum, fmtScore } from '@/lib/format'

interface QueryState<T> {
  loading: boolean
  error: string | null
  data: T | null
}

function newState<T>(): QueryState<T> {
  return { loading: false, error: null, data: null }
}

const resumen = reactive(newState<ResumenGrafo>())
const topClientes = reactive(newState<TopClienteMonto[]>())
const txCanal = reactive(newState<TxPorCanal[]>())
const txPaisRiesgo = reactive(newState<TxPaisRiesgo[]>())
const anillos = reactive(newState<AnilloSospechoso[]>())
const dispositivos = reactive(newState<DispositivoCompartido[]>())
const comercios = reactive(newState<ComercioConAlertas[]>())
const path = reactive(newState<PathClientes>())

const params = reactive({
  topLimit: 10,
  anillosMin: 500,
  dispMin: 2,
  pathFrom: '',
  pathTo: '',
  pathMax: 4,
})

async function call<T>(s: QueryState<T>, fn: () => Promise<T>) {
  s.loading = true
  s.error = null
  try {
    s.data = await fn()
  } catch (e: unknown) {
    s.error = e instanceof Error ? e.message : 'Error en la consulta'
  } finally {
    s.loading = false
  }
}

const loadResumen      = () => call(resumen,      analyticsApi.resumenGrafo)
const loadTop          = () => call(topClientes,  async () => (await analyticsApi.topClientesMonto(params.topLimit)).items)
const loadCanal        = () => call(txCanal,      async () => (await analyticsApi.txPorCanal()).items)
const loadPaisRiesgo   = () => call(txPaisRiesgo, async () => (await analyticsApi.txPaisRiesgo()).items)
const loadAnillos      = () => call(anillos,      async () => (await analyticsApi.anillosSospechosos(params.anillosMin)).items)
const loadDispositivos = () => call(dispositivos, async () => (await analyticsApi.dispositivosCompartidos(params.dispMin)).items)
const loadComercios    = () => call(comercios,    async () => (await analyticsApi.comerciosConAlertas()).items)

async function loadPath() {
  if (!params.pathFrom || !params.pathTo) {
    path.error = 'Ingresa from y to (cliente_id) para buscar el camino'
    return
  }
  await call(path, () => analyticsApi.pathClientes(params.pathFrom, params.pathTo, params.pathMax))
}

// Drilldown: dispositivo compartido -> lista de clientes
const dispDrilldown = ref<DispositivoCompartido | null>(null)

function loadAll() {
  loadResumen()
  loadTop()
  loadCanal()
  loadPaisRiesgo()
  loadAnillos()
  loadDispositivos()
  loadComercios()
}

onMounted(loadAll)

const labelChart = computed(() => ({
  labels: resumen.data?.por_label.map((r) => r.label) ?? [],
  data: resumen.data?.por_label.map((r) => r.total) ?? [],
}))
const relChart = computed(() => ({
  labels: resumen.data?.por_relacion.map((r) => r.tipo) ?? [],
  data: resumen.data?.por_relacion.map((r) => r.total) ?? [],
}))
const canalChart = computed(() => {
  const items = txCanal.data ?? []
  return {
    labels: items.map((r) => `${r.canal}/${r.estado}`),
    data: items.map((r) => r.total),
  }
})
const comerciosChart = computed(() => {
  const items = (comercios.data ?? []).slice(0, 10)
  return {
    labels: items.map((r) => r.nombre),
    data: items.map((r) => r.num_alertas),
  }
})
</script>

<template>
  <div class="space-y-6">
    <!-- KPI ROW: resumen-grafo -->
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Nodos totales</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(resumen.data?.totales.nodos) }}
        </div>
      </div>
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Relaciones totales</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(resumen.data?.totales.relaciones) }}
        </div>
      </div>
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Labels distintos</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(resumen.data?.por_label.length) }}
        </div>
      </div>
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Tipos de relación</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ fmtNum(resumen.data?.por_relacion.length) }}
        </div>
      </div>
    </section>

    <div class="flex items-center justify-end">
      <button class="btn-secondary" @click="loadAll">Recargar todo</button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <QueryCard
        title="Resumen del grafo"
        question="Conteo de nodos por label y relaciones por tipo."
        :loading="resumen.loading"
        :error="resumen.error"
        @reload="loadResumen"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div class="text-xs font-semibold text-slate-500 mb-2">Nodos por label</div>
            <BarChart
              :labels="labelChart.labels"
              :data="labelChart.data"
              color="#7c3aed"
              :height="180"
            />
          </div>
          <div>
            <div class="text-xs font-semibold text-slate-500 mb-2">Relaciones por tipo</div>
            <BarChart
              :labels="relChart.labels"
              :data="relChart.data"
              color="#0ea5e9"
              :height="180"
            />
          </div>
        </div>
      </QueryCard>

      <QueryCard
        title="Top clientes por monto"
        question="¿Quién mueve más dinero? — riesgo de lavado."
        :count="topClientes.data?.length"
        :loading="topClientes.loading"
        :error="topClientes.error"
        @reload="loadTop"
      >
        <template #params>
          <div>
            <label class="label">Limit</label>
            <input v-model.number="params.topLimit" type="number" min="1" max="100"
                   class="input w-24" @change="loadTop" />
          </div>
        </template>
        <div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th class="py-2 pr-3">Cliente</th>
                <th class="py-2 pr-3">País</th>
                <th class="py-2 pr-3 text-right">Tx</th>
                <th class="py-2 pr-3 text-right">Monto total</th>
                <th class="py-2 text-right">Promedio</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in topClientes.data" :key="r.cliente_id"
                  class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-1.5 pr-3">
                  <div class="font-medium text-slate-800">{{ r.nombre }}</div>
                  <div class="font-mono text-[11px] text-slate-400">{{ r.cliente_id }}</div>
                </td>
                <td class="py-1.5 pr-3">{{ r.pais }}</td>
                <td class="py-1.5 pr-3 text-right">{{ fmtNum(r.num_transacciones) }}</td>
                <td class="py-1.5 pr-3 text-right font-semibold">{{ fmtMoney(r.monto_total) }}</td>
                <td class="py-1.5 text-right text-slate-500">{{ fmtMoney(r.monto_promedio) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </QueryCard>

      <QueryCard
        title="Transacciones por canal"
        question="Distribución canal/estado para detectar canales con alto rechazo."
        :count="txCanal.data?.length"
        :loading="txCanal.loading"
        :error="txCanal.error"
        @reload="loadCanal"
      >
        <BarChart
          :labels="canalChart.labels"
          :data="canalChart.data"
          color="#10b981"
          :height="220"
        />
      </QueryCard>

      <QueryCard
        title="Transacciones desde países de alto riesgo"
        question="Movimientos desde jurisdicciones FATF de alto riesgo."
        :count="txPaisRiesgo.data?.length"
        :loading="txPaisRiesgo.loading"
        :error="txPaisRiesgo.error"
        @reload="loadPaisRiesgo"
      >
        <div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th class="py-2 pr-3">País</th>
                <th class="py-2 pr-3 text-right">Tx</th>
                <th class="py-2 pr-3 text-right">Monto</th>
                <th class="py-2 pr-3 text-right">Score</th>
                <th class="py-2">Clientes (muestra)</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="r in txPaisRiesgo.data" :key="r.pais"
                  class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-1.5 pr-3 font-medium">{{ r.pais }}</td>
                <td class="py-1.5 pr-3 text-right">{{ fmtNum(r.transacciones) }}</td>
                <td class="py-1.5 pr-3 text-right">{{ fmtMoney(r.monto_total) }}</td>
                <td class="py-1.5 pr-3 text-right">
                  <span class="badge-warn">{{ fmtScore(r.score_riesgo_promedio) }}</span>
                </td>
                <td class="py-1.5 text-[11px] font-mono text-slate-500">
                  {{ r.clientes_muestra.slice(0, 3).join(', ') }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </QueryCard>

      <QueryCard
        title="Anillos sospechosos (smurfing)"
        question="Pares de cuentas con transferencias mutuas. Min monto = umbral por transacción individual."
        :count="anillos.data?.length"
        :loading="anillos.loading"
        :error="anillos.error"
        @reload="loadAnillos"
      >
        <template #params>
          <div>
            <label class="label">Min monto por tx</label>
            <input v-model.number="params.anillosMin" type="number" min="0" step="100"
                   class="input w-32" @change="loadAnillos" />
          </div>
        </template>
        <div v-if="!anillos.data?.length" class="text-sm text-slate-400">
          Sin anillos por encima del umbral.
        </div>
        <ul v-else class="space-y-2 max-h-[280px] overflow-y-auto">
          <li v-for="(a, i) in anillos.data" :key="i"
              class="border border-slate-200 rounded-lg p-3 text-sm">
            <div class="flex items-center justify-between">
              <div class="font-mono text-xs text-slate-700">
                {{ a.cuenta_a }} ⇄ {{ a.cuenta_b }}
              </div>
              <span class="badge-err">{{ fmtMoney(a.volumen_total) }}</span>
            </div>
            <div class="text-[11px] text-slate-500 mt-1">
              Ida: {{ a.num_ida }} tx · Regreso: {{ a.num_regreso }} tx · volumen sumado
            </div>
          </li>
        </ul>
      </QueryCard>

      <QueryCard
        title="Dispositivos compartidos"
        question="Account takeover: dispositivos usados por varios clientes."
        :count="dispositivos.data?.length"
        :loading="dispositivos.loading"
        :error="dispositivos.error"
        @reload="loadDispositivos"
      >
        <template #params>
          <div>
            <label class="label">Min clientes</label>
            <input v-model.number="params.dispMin" type="number" min="2"
                   class="input w-24" @change="loadDispositivos" />
          </div>
        </template>
        <div class="overflow-x-auto -mx-5 px-5">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs uppercase tracking-wider text-slate-500 border-b">
                <th class="py-2 pr-3">Dispositivo</th>
                <th class="py-2 pr-3">Tipo</th>
                <th class="py-2 pr-3">SO</th>
                <th class="py-2 text-right">Clientes</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="d in dispositivos.data" :key="d.dispositivo"
                  class="border-b border-slate-100 hover:bg-slate-50">
                <td class="py-1.5 pr-3 font-mono text-xs">{{ d.dispositivo }}</td>
                <td class="py-1.5 pr-3">{{ d.tipo }}</td>
                <td class="py-1.5 pr-3">{{ d.sistema_op }}</td>
                <td class="py-1.5 text-right">
                  <button
                    class="badge-warn hover:bg-amber-200 transition cursor-pointer"
                    title="Ver clientes que comparten este dispositivo"
                    @click="dispDrilldown = d"
                  >
                    {{ d.num_clientes }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </QueryCard>
      <QueryCard
        title="Comercios con más alertas"
        question="Comercios que generan más alertas de fraude."
        :count="comercios.data?.length"
        :loading="comercios.loading"
        :error="comercios.error"
        @reload="loadComercios"
      >
        <BarChart
          :labels="comerciosChart.labels"
          :data="comerciosChart.data"
          color="#f43f5e"
          :height="220"
        />
      </QueryCard>

      <QueryCard
        title="Camino entre dos clientes"
        question="shortestPath para descubrir comunidades / colusión entre clientes."
        :loading="path.loading"
        :error="path.error"
        @reload="loadPath"
      >
        <template #params>
          <div>
            <label class="label">From (cliente_id)</label>
            <input v-model="params.pathFrom" placeholder="CLI-00001"
                   class="input w-40" />
          </div>
          <div>
            <label class="label">To (cliente_id)</label>
            <input v-model="params.pathTo" placeholder="CLI-00050"
                   class="input w-40" />
          </div>
          <div>
            <label class="label">Max</label>
            <input v-model.number="params.pathMax" type="number" min="1" max="6"
                   class="input w-20" />
          </div>
          <button class="btn-primary" @click="loadPath">Buscar</button>
        </template>
        <div v-if="path.data?.distancia != null" class="space-y-3">
          <div class="flex items-center gap-2">
            <span class="badge-ok">distancia: {{ path.data.distancia }}</span>
            <span class="text-xs text-slate-500">
              {{ path.data.p?.segments.length || 0 }} segmento(s)
            </span>
          </div>
          <ol class="space-y-1 text-sm font-mono text-slate-700">
            <li v-for="(seg, i) in path.data.p?.segments ?? []" :key="i"
                class="flex items-center gap-2 text-xs">
              <span class="badge-muted">{{ seg.start.labels.join(':') }}</span>
              <span class="text-slate-400">→ [{{ seg.relationship.type }}] →</span>
              <span class="badge-muted">{{ seg.end.labels.join(':') }}</span>
            </li>
          </ol>
        </div>
        <div v-else-if="path.data && path.data.distancia == null"
             class="text-sm text-slate-400">
          No se encontró camino entre los clientes indicados.
        </div>
        <div v-else-if="!path.error" class="text-sm text-slate-400">
          Ingresa dos cliente_id y presiona <em>Buscar</em>.
        </div>
      </QueryCard>
    </div>

    <Modal
      :open="dispDrilldown !== null"
      :title="dispDrilldown ? `Clientes que comparten ${dispDrilldown.dispositivo}` : ''"
      size="md"
      @close="dispDrilldown = null"
    >
      <div v-if="dispDrilldown" class="space-y-3">
        <div class="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 text-sm">
          <div class="grid grid-cols-3 gap-3 text-xs">
            <div>
              <div class="uppercase tracking-wider text-slate-500">Tipo</div>
              <div class="text-slate-800 mt-0.5">{{ dispDrilldown.tipo }}</div>
            </div>
            <div>
              <div class="uppercase tracking-wider text-slate-500">Sistema operativo</div>
              <div class="text-slate-800 mt-0.5">{{ dispDrilldown.sistema_op }}</div>
            </div>
            <div>
              <div class="uppercase tracking-wider text-slate-500">Total clientes</div>
              <div class="text-slate-800 mt-0.5 font-semibold">{{ dispDrilldown.num_clientes }}</div>
            </div>
          </div>
        </div>

        <div>
          <div class="text-xs text-slate-500 mb-2">
            Mostrando {{ dispDrilldown.clientes_muestra.length }}
            de {{ dispDrilldown.num_clientes }} clientes
            <span v-if="dispDrilldown.clientes_muestra.length < dispDrilldown.num_clientes">
              (la query limita a 10 por dispositivo)
            </span>
          </div>
          <ul class="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
            <li
              v-for="cli in dispDrilldown.clientes_muestra"
              :key="cli"
              class="px-4 py-2 flex items-center justify-between hover:bg-slate-50"
            >
              <span class="font-mono text-sm text-slate-700">{{ cli }}</span>
              <RouterLink
                :to="{ name: 'nodos.detail', params: { label: 'Cliente', id: cli } }"
                class="text-xs text-brand-600 hover:underline"
                @click="dispDrilldown = null"
              >
                Abrir ficha
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>

      <template #footer>
        <button class="btn-secondary" @click="dispDrilldown = null">Cerrar</button>
      </template>
    </Modal>
  </div>
</template>
