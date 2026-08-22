declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>;
  export default component;
}

type LayoutName = 'default' | 'blank';

interface DefinePageConfig {
  route?: string;
  head?: string;
  layout?: LayoutName;
}

declare global {
  function definePage(config: DefinePageConfig): void;
}

declare module 'vue-router' {
  interface RouteMeta {
    layout?: LayoutName;
    title?: string;
  }
}

export {};
