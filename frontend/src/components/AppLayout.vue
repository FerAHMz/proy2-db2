<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { getHealth } from '@/api/health'

interface NavItem { to: string; label: string; matchPrefix?: string }

const nav: NavItem[] = [
  { to: '/',            label: 'Dashboard analítico'   },
  { to: '/grafo',       label: 'Grafo del sistema'     },
  { to: '/nodos',       label: 'Explorar nodos',        matchPrefix: '/nodos' },
  { to: '/nodos/crear', label: 'Crear nodo'             },
  { to: '/relaciones',  label: 'Auditoría relaciones'   },
  { to: '/csv',         label: 'Importar CSV'           },
]

const route = useRoute()
const pageTitle = computed(() => (route.meta?.title as string) || 'FraudGraph')

function isActive(item: NavItem) {
  if (route.path === item.to) return true
  if (item.matchPrefix && route.path.startsWith(item.matchPrefix)) {
    if (item.to === '/nodos' && route.path === '/nodos/crear') return false
    return true
  }
  return false
}

type HealthState = 'idle' | 'checking' | 'ok' | 'down'
const healthState = ref<HealthState>('idle')

async function checkHealth() {
  healthState.value = 'checking'
  try {
    const h = await getHealth()
    healthState.value = h.neo4j ? 'ok' : 'down'
  } catch {
    healthState.value = 'down'
  }
}

onMounted(checkHealth)
</script>

<template>
  <div class="min-h-screen flex bg-slate-50">
    <aside class="w-64 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      <div class="px-5 py-5 border-b border-slate-200">
        <div class="flex items-center gap-2.5">
          <div class="w-9 h-9 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700
                      flex items-center justify-center text-white font-bold">
            F
          </div>
          <div>
            <div class="font-semibold text-slate-900 leading-tight">FraudGraph</div>
            <div class="text-xs text-slate-500 leading-tight">Detección de fraude · Neo4j</div>
          </div>
        </div>
      </div>

      <nav class="flex-1 px-3 py-4 space-y-0.5">
        <RouterLink
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :class="[
            'block px-3 py-2 rounded-lg text-sm transition-colors',
            isActive(item)
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-slate-700 hover:bg-slate-100',
          ]"
        >
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="px-4 py-3 border-t border-slate-200">
        <div class="flex items-center gap-2 text-xs text-slate-500">
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-emerald-500': healthState === 'ok',
              'bg-rose-500': healthState === 'down',
              'bg-amber-400 animate-pulse': healthState === 'checking',
              'bg-slate-300': healthState === 'idle',
            }"
          />
          <span>{{ healthState === 'ok' ? 'Conectado' : healthState === 'down' ? 'Sin conexión' : 'Comprobando…' }}</span>
        </div>
      </div>
    </aside>

    <div class="flex-1 flex flex-col min-w-0">
      <header class="h-14 bg-white border-b border-slate-200 px-6 flex items-center">
        <h1 class="text-base font-semibold text-slate-900">{{ pageTitle }}</h1>
      </header>
      <main class="flex-1 p-6 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>
