import { useRouter } from 'vue-router';

export * from './seo';
export * from './fonts';
export * from './file';
export * from './display';

export const useRedirect = () => {
  const router = useRouter();

  const redirectTo = (route: string) => {
    router.push(route);
  };

  return { redirectTo };
};
