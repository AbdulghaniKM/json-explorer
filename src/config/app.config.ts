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

  theme: {
    defaultTheme: 'system',
    light: {
      primary: '#4f46e5',
      secondary: '#0ea5e9',
      accent: '#d97706',
      background: '#ffffff',
      surface: '#f8fafc',
      text: '#0f172a',
      textSecondary: '#64748b',
      border: '#e2e8f0',
      muted: '#f1f5f9',
      link: '#4f46e5',
      linkHover: '#4338ca',
      emphasis: '#3730a3',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626',
      info: '#0284c7',
    },
    dark: {
      primary: '#818cf8',
      secondary: '#38bdf8',
      accent: '#fbbf24',
      background: '#0b1120',
      surface: '#111a2e',
      text: '#e2e8f0',
      textSecondary: '#94a3b8',
      border: '#26334d',
      muted: '#1b2540',
      link: '#818cf8',
      linkHover: '#a5b4fc',
      emphasis: '#a5b4fc',
      success: '#34d399',
      warning: '#fbbf24',
      error: '#f87171',
      info: '#38bdf8',
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
    mono: {
      family: 'JetBrains Mono',
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
