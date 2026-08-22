import { createRouter, createWebHistory } from 'vue-router';
import { routes } from '@/config/router';

const router = createRouter({
  history: createWebHistory(),
  routes: [...routes],
  scrollBehavior() {
    return { top: 0 };
  },
});

export default router;
