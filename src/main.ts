import { createPinia } from 'pinia';
import { createApp } from 'vue';

(window as any).definePage = () => {};

import App from './App.vue';
import router from './router';
import './style.css';
import { initializeConfig } from './config';
import { useToast } from './composables/useToast';
import '@/composables/useAppUi';

initializeConfig();

const pinia = createPinia();
const app = createApp(App);

const toast = useToast();

app.config.errorHandler = (err, _instance, info) => {
  console.error('[vue:error]', info, err);
  if (import.meta.env.DEV) {
    const message = err instanceof Error ? err.message : String(err);
    toast.error(message, { title: 'Render error' });
  }
};

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason);
  if (import.meta.env.DEV) {
    const reason = event.reason;
    const message = reason instanceof Error ? reason.message : String(reason);
    toast.error(message, { title: 'Unhandled promise rejection' });
  }
});

app.use(pinia);
app.use(router);

app.mount('#app');
