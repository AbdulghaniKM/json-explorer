import type { ThemeConfig, ColorPalette } from '../config/types';
import { DENSITY_VARIABLES } from '../config/density';

export type { ColorPalette };

export const generateCSSVariables = (theme: ThemeConfig): string => {
  const lightVars = generateColorVariables(theme.light);
  const darkVars = generateColorVariables(theme.dark);

  return `
    :root {
      ${lightVars}
    }

    [data-theme="dark"] {
      ${darkVars}
    }

    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) {
        ${darkVars}
      }
    }
  `;
};

const camelToKebab = (str: string): string => str.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();

const generateColorVariables = (palette: ColorPalette): string =>
  Object.entries(palette)
    .filter(([, value]) => value)
    .map(([key, value]) => `  --color-${camelToKebab(key)}: ${value};`)
    .join('\n');

const writeStyleElement = (id: string, css: string): void => {
  let styleElement = document.getElementById(id) as HTMLStyleElement | null;

  if (!styleElement) {
    styleElement = document.createElement('style');
    styleElement.id = id;
    document.head.appendChild(styleElement);
  }

  styleElement.textContent = css;
};

export const applyTheme = (theme: ThemeConfig): void => {
  if (typeof document === 'undefined') return;
  writeStyleElement('app-theme-variables', generateCSSVariables(theme));
};

export const applyDensity = (): void => {
  if (typeof document === 'undefined') return;
  const declarations = Object.entries(DENSITY_VARIABLES)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  writeStyleElement('app-density-variables', `:root {\n${declarations}\n}`);
};

let transitionTimer: ReturnType<typeof setTimeout> | null = null;

export const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export const applyThemeToDOM = (theme: 'light' | 'dark' | 'system'): void => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  // Scope transitions to a ~300ms window after a theme swap. Avoids the
  // universal `* { transition }` perf cost on every hover/focus.
  root.classList.add('theme-switching');
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = setTimeout(() => {
    root.classList.remove('theme-switching');
    transitionTimer = null;
  }, 300);

  // Always resolve to a concrete value. Dark is now the bare `:root` palette, so clearing the
  // attribute would mean "dark" rather than "follow the OS".
  root.setAttribute('data-theme', theme === 'system' ? getSystemTheme() : theme);
};

export const getColorValue = (colorKey: keyof ColorPalette): string =>
  `var(--color-${camelToKebab(colorKey)})`;
