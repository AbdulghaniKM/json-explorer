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
      background: '#f7f7f8',
      foreground: '#0c0c0e', // 17.8:1
      card: '#ffffff',
      cardForeground: '#0c0c0e',
      popover: '#ffffff',
      popoverForeground: '#0c0c0e',
      primary: '#0f7a3d', // 5.0:1 on background
      primaryForeground: '#ffffff', // 5.3:1 on primary
      secondary: '#ededf0',
      secondaryForeground: '#0c0c0e',
      muted: '#ededf0',
      mutedForeground: '#5c5d66', // 5.8:1
      accent: '#e6e6ea',
      accentForeground: '#0c0c0e',
      border: '#dcdce1',
      input: '#c4c4cc',
      ring: '#0f7a3d',
      success: '#0f7a3d',
      warning: '#8a6100',
      error: '#b91c1c',
      destructive: '#b91c1c',
      info: '#0e6c7a',
    },
    dark: {
      // Neutral zinc, not a green-tinted canvas. Green has to be the only saturated thing
      // on screen or it stops reading as an accent and starts reading as a colour cast.
      background: '#111113',
      foreground: '#e4e4e7', // 14.9:1
      card: '#191a1c',
      cardForeground: '#e4e4e7',
      popover: '#1e1f22',
      popoverForeground: '#e4e4e7',
      primary: '#00e05c', // 10.6:1 on background
      primaryForeground: '#08130c', // 10.7:1 on primary
      secondary: '#26272b',
      secondaryForeground: '#e4e4e7',
      muted: '#1e1f22',
      mutedForeground: '#8e8f96', // 5.9:1
      accent: '#26272b',
      accentForeground: '#e4e4e7',
      border: '#2a2b2f',
      input: '#3a3b40',
      ring: '#00ff41', // canonical Matrix green, only ever a focus outline
      success: '#00e05c',
      warning: '#e8c547',
      error: '#ff6b62',
      destructive: '#ff6b62',
      info: '#5ad7e8',
    },
  },

  // One typeface. The app is a tool for reading raw text, so the UI is set in the same face
  // as the data it shows — the variable weight axis (100–800) supplies the hierarchy that a
  // second family would otherwise provide.
  //
  // The previous primary was IBM Plex Sans *Arabic*, shipped as a 227 kB TTF with a single
  // weight and used for English UI. It is no longer fetched. public/font/ still holds the
  // file; delete it whenever you like.
  typography: {
    primary: {
      family: 'JetBrains Mono Variable',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      cssVariable: 'font-primary',
    },
    secondary: {
      family: 'JetBrains Mono Variable',
      fallbacks: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      cssVariable: 'font-secondary',
    },
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
