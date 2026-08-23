import type { AppConfig } from './types';
import { appIdentity } from './identity';

export const appConfig: AppConfig = {
  app: {
    name: appIdentity.name,
    title: appIdentity.title,
    description: appIdentity.description,
    version: '1.0.0',
    author: 'AbdulghaniKM',
    url: appIdentity.url,
    language: 'en',
  },

  // Terminal Brutalist. Dark is the canonical mode — phosphor green only reads as phosphor
  // green against black, so light mode is an honest paper-and-ink translation rather than an
  // imitation. Every contrast ratio in the comments is computed, not estimated; re-run
  // scripts/contrast.js if you touch a value.
  theme: {
    defaultTheme: 'dark',
    light: {
      background: '#f6f7f3',
      foreground: '#0b0e0b', // 18.0:1
      card: '#ffffff',
      cardForeground: '#0b0e0b',
      popover: '#ffffff',
      popoverForeground: '#0b0e0b',
      primary: '#0f7a3d', // 5.0:1 on background
      primaryForeground: '#ffffff', // 5.3:1 on primary
      secondary: '#eceee7',
      secondaryForeground: '#0b0e0b',
      muted: '#eceee7',
      mutedForeground: '#5a655a', // 5.7:1
      accent: '#e3e7dd',
      accentForeground: '#0b0e0b',
      border: '#dce2d8',
      input: '#c8d1c4',
      ring: '#0f7a3d',
      success: '#0f7a3d',
      warning: '#8a6100',
      error: '#b91c1c',
      destructive: '#b91c1c',
      info: '#0e6c7a',
    },
    dark: {
      background: '#0a0d0a',
      foreground: '#d5e3d5', // 14.7:1
      card: '#0f130f',
      cardForeground: '#d5e3d5',
      popover: '#141914',
      popoverForeground: '#d5e3d5',
      primary: '#00e05c', // 11.0:1 on background
      primaryForeground: '#04120a', // 11.0:1 on primary
      secondary: '#1a201a',
      secondaryForeground: '#d5e3d5',
      muted: '#161b16',
      mutedForeground: '#7e8f7e', // 5.7:1
      accent: '#1c231c',
      accentForeground: '#d5e3d5',
      border: '#1c221c',
      input: '#2a332a',
      ring: '#00ff41', // canonical Matrix green, only ever a focus outline
      success: '#00e05c',
      warning: '#e8c547',
      error: '#ff5f56',
      destructive: '#ff5f56',
      info: '#5ad7e8',
    },
  },

  typography: {
    fonts: [
      {
        name: 'IBM Plex Sans',
        src: '/font/IBMPlexSansArabic-Regular.ttf',
        weight: 400,
        style: 'normal',
        display: 'swap',
        preload: true,
      },
    ],
    primary: {
      family: 'IBM Plex Sans',
      fallbacks: [
        'system-ui',
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'sans-serif',
      ],
      cssVariable: 'font-primary',
    },
    secondary: {
      family: 'IBM Plex Sans',
      fallbacks: ['system-ui', 'sans-serif'],
      cssVariable: 'font-secondary',
    },
    // Declared by @fontsource-variable/jetbrains-mono, imported in style.css. The family name
    // has to match that package's @font-face exactly — registerFontFamily writes it straight
    // into --font-mono as an inline style on <html>, where nothing else can correct it.
    mono: {
      family: 'JetBrains Mono Variable',
      fallbacks: [
        'ui-monospace',
        'SFMono-Regular',
        'Menlo',
        'Consolas',
        'Liberation Mono',
        'monospace',
      ],
      cssVariable: 'font-mono',
    },
  },

  icons: {
    favicon: '/favicon.svg',
    sizes: ['192x192', '512x512'],
  },

  seo: {
    title: appIdentity.title,
    description: appIdentity.description,
    keywords: [
      'json',
      'json viewer',
      'json formatter',
      'json beautifier',
      'json diff',
      'json validator',
      'json to typescript',
      'json to yaml',
      'json to csv',
    ],
    robots: 'index, follow',
    openGraph: {
      siteName: appIdentity.name,
      type: 'website',
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
    },
  },

  layout: {
    containerMaxWidth: '1400px',
  },
};
