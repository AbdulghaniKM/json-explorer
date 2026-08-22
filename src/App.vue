<template>
  <UiAppPageLoader ref="pageLoaderRef" />
  <component :is="Layout" v-if="Layout">
    <RouterView />
  </component>
  <RouterView v-else />
  <UiAppToast :toasts="toasts" @remove="remove" @pause="pause" @resume="resume" />
</template>

<script setup lang="ts">
  import AppPageLoader from '@/components/ui/AppPageLoader.vue';
  import DefaultLayout from '@/layouts/DefaultLayout.vue';

  const route = useRoute();
  const router = useRouter();

  const Layout = computed(() => (route.meta.layout === 'blank' ? null : DefaultLayout));

  const { toasts, remove, pause, resume } = useToast();

  const pageLoaderRef = ref<InstanceType<typeof AppPageLoader> | null>(null);

  router.beforeEach(() => {
    pageLoaderRef.value?.start();
  });

  router.afterEach(() => {
    pageLoaderRef.value?.done();
  });

  router.onError(() => {
    pageLoaderRef.value?.done();
  });

  watch(
    () => route.meta.title,
    (title) => {
      if (typeof title === 'string' && title) document.title = title;
    },
    { immediate: true },
  );
</script>
