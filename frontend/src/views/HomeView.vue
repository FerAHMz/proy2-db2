<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getApiIndex, getHealth, type ApiIndex, type HealthResponse } from '@/api/health'

const health = ref<HealthResponse | null>(null)
const index = ref<ApiIndex | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const [h, i] = await Promise.all([getHealth(), getApiIndex()])
    health.value = h
    index.value = i
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Error al consultar la API'
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="max-w-5xl space-y-6">
    <section class="card">
      <div class="card-body">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-wider text-brand-600 font-semibold">
              Proyecto 2 · Bases de Datos 2
            </p>
            <h2 class="text-2xl font-semibold text-slate-900 mt-1">
              Detección de fraude bancario sobre Neo4j
            </h2>
            <p class="text-slate-600 mt-2 max-w-2xl">
              Frontend de gestión sobre el grafo de fraude. Cada operación CRUD
              corresponde a una acción real del equipo de compliance.
            </p>
          </div>
          <button class="btn-secondary" :disabled="loading" @click="load">
            {{ loading ? 'Consultando…' : 'Recargar' }}
          </button>
        </div>
      </div>
    </section>

    <section class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Estado API</div>
        <div class="mt-2 flex items-center gap-2">
          <span v-if="health?.neo4j" class="badge-ok">conectada</span>
          <span v-else-if="loading" class="badge-muted">cargando…</span>
          <span v-else class="badge-err">sin conexión</span>
        </div>
        <div v-if="error" class="text-xs text-rose-600 mt-2">{{ error }}</div>
      </div>

      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Driver Neo4j</div>
        <div class="mt-2">
          <span v-if="health?.neo4j" class="badge-ok">activo</span>
          <span v-else class="badge-err">inactivo</span>
        </div>
      </div>

      <div class="card card-body">
        <div class="text-xs uppercase tracking-wider text-slate-500">Endpoints</div>
        <div class="text-2xl font-semibold text-slate-900 mt-1">
          {{ index?.endpoints.length ?? '—' }}
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card-header flex items-center justify-between">
        <h3 class="font-semibold text-slate-900">Endpoints disponibles</h3>
        <span class="text-xs text-slate-500">{{ index?.name }}</span>
      </div>
      <div class="card-body">
        <div v-if="loading" class="text-sm text-slate-500">Cargando…</div>
        <div v-else-if="!index" class="text-sm text-rose-600">
          No se pudo cargar el índice de endpoints.
        </div>
        <ul v-else class="font-mono text-xs space-y-1 text-slate-700 max-h-[420px] overflow-y-auto">
          <li
            v-for="ep in index.endpoints"
            :key="ep"
            class="px-2 py-1 rounded hover:bg-slate-50"
          >
            {{ ep }}
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
