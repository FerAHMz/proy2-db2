import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard analítico' },
      },
      {
        path: 'grafo',
        name: 'grafo',
        component: () => import('@/views/GraphExplorerView.vue'),
        meta: { title: 'Grafo del sistema' },
      },
      {
        path: 'nodos',
        name: 'nodos',
        component: () => import('@/views/NodesIndexView.vue'),
        meta: { title: 'Explorar nodos' },
      },
      {
        path: 'nodos/:label',
        name: 'nodos.label',
        component: () => import('@/views/NodeListView.vue'),
        meta: { title: 'Tabla de nodos' },
      },
      {
        path: 'nodos/:label/:id',
        name: 'nodos.detail',
        component: () => import('@/views/NodeDetailView.vue'),
        meta: { title: 'Ficha de entidad' },
      },
      {
        path: 'nodos/crear',
        name: 'nodos.crear',
        component: () => import('@/views/NodeCreateView.vue'),
        meta: { title: 'Crear nodo' },
      },
      {
        path: 'relaciones',
        name: 'relaciones',
        component: () => import('@/views/RelationshipsView.vue'),
        meta: { title: 'Auditoría de relaciones' },
      },
      {
        path: 'csv',
        name: 'csv',
        component: () => import('@/views/CsvImportView.vue'),
        meta: { title: 'Importar CSV' },
      },
      {
        path: ':pathMatch(.*)*',
        name: 'not-found',
        component: () => import('@/views/NotFoundView.vue'),
        meta: { title: 'No encontrado' },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.afterEach((to) => {
  const t = (to.meta?.title as string) || 'FraudGraph'
  document.title = `${t} · FraudGraph`
})
