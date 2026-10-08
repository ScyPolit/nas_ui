import { createRouter, createWebHashHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeDashboard.vue'),
    },
    {
      path: '/files/:path(.*)*',
      name: 'files',
      component: () => import('@/views/FileExplorer.vue'),
      props: (route) => ({ path: Array.isArray(route.params.path) ? route.params.path.join('/') : route.params.path ?? '' }),
    },
    {
      path: '/recent-viewed',
      name: 'recent-viewed',
      component: () => import('@/views/RecentViewed.vue'),
    },
    {
      path: '/recent-saved',
      name: 'recent-saved',
      component: () => import('@/views/RecentSaved.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})
