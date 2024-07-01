import { createRouter, createWebHistory } from 'vue-router'
import MapaComponent from '@/components/MapaComponent.vue'
import AuditoriaComponent from '@/components/AuditoriaComponent.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: MapaComponent
    },
    {
      path: '/auditoria',
      name: 'auditoria',
      // route level code-splitting
      // this generates a separate chunk (About.[hash].js) for this route
      // which is lazy-loaded when the route is visited.
      component: AuditoriaComponent
    }
  ]
})

export default router
