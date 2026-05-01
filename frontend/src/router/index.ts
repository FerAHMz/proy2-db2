import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/HomeView.vue'),
        meta: { title: 'Inicio' },
      },
      {
        path: 'dashboard',
        name: 'dashboard',
        component: () => import('@/views/DashboardView.vue'),
        meta: { title: 'Dashboard analítico' },
      },
      {
        path: 'nodos',
        name: 'nodos',
        component: () => import('@/views/PlaceholderView.vue'),
        meta: { title: 'Explorar nodos', soon: true },
      },
      {
        path: 'nodos/crear',
        name: 'nodos.crear',
        component: () => import('@/views/PlaceholderView.vue'),
        meta: { title: 'Crear nodo', soon: true },
      },
      {
        path: 'relaciones',
        name: 'relaciones',
        component: () => import('@/views/PlaceholderView.vue'),
        meta: { title: 'Auditoría de relaciones', soon: true },
      },
      {
        path: 'csv',
        name: 'csv',
        component: () => import('@/views/PlaceholderView.vue'),
        meta: { title: 'Importar CSV', soon: true },
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
