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

/**
 * Pre-rename utility names, emitted alongside the current ones so both vocabularies resolve
 * while the call sites migrate. Delete this map — and the matching entries in style.css's
 * `@theme` — in the same commit that removes the last legacy class.
 *
 * `text-muted` earns its place here: it used to exist *only* as `var(--color-text-secondary)`
 * inside `@theme`, so the 61 `text-text-muted` call sites would have silently dropped to a
 * build-time grey the moment `--color-text-secondary` stopped being emitted.
 */
const LEGACY_ALIASES: Record<string, keyof ColorPalette> = {
  surface: 'card',
  text: 'foreground',
  'text-secondary': 'mutedForeground',
  'text-muted': 'mutedForeground',
};

const generateColorVariables = (palette: ColorPalette): string => {
  const declarations = Object.entries(palette)
    .filter(([, value]) => value)
    .map(([key, value]) => `  --color-${camelToKebab(key)}: ${value};`);

  for (const [legacy, current] of Object.entries(LEGACY_ALIASES)) {
    const value = palette[current];
    if (value) declarations.push(`  --color-${legacy}: ${value};`);
  }

  return declarations.join('\n');
};

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
