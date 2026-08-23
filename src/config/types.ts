/**
 * Named after shadcn/ui's token vocabulary, so a component lifted from a shadcn-shaped
 * registry keeps its Tailwind classes and only needs its template translated.
 *
 * The four status colors are ours, not shadcn's: this app has to distinguish valid, invalid,
 * repaired and informational states, which a lone `destructive` cannot express. `destructive`
 * is carried alongside `error` at the same value purely so ported components resolve.
 */
export interface ColorPalette {
  background: string;
  foreground: string;
  /** Panels, sitting one step above the canvas. */
  card: string;
  cardForeground: string;
  /** Menus and popovers, which read as lifted rather than inset. */
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  /** A subtle surface — not a text color. `mutedForeground` is the text one. */
  muted: string;
  mutedForeground: string;
  /** shadcn semantics: the hover/active surface, not a brand color. */
  accent: string;
  accentForeground: string;
  border: string;
  /** Form control borders, which sit a step stronger than `border`. */
  input: string;
  ring: string;
  success?: string;
  warning?: string;
  error?: string;
  destructive?: string;
  info?: string;
}

export interface ThemeConfig {
  light: ColorPalette;
  dark: ColorPalette;
  defaultTheme?: 'light' | 'dark' | 'system';
}

export interface FontConfig {
  name: string;
  src: string | string[];
  weight?: string | number | (string | number)[];
  style?: 'normal' | 'italic' | 'oblique';
  display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
  preload?: boolean;
}

export interface TypographyConfig {
  fonts?: FontConfig[];
  primary: {
    family: string;
    fallbacks?: string[];
    cssVariable?: string;
  };
  secondary?: {
    family: string;
    fallbacks?: string[];
    cssVariable?: string;
  };
  mono?: {
    family: string;
    fallbacks?: string[];
    cssVariable?: string;
  };
}

export interface AppMetadata {
  name: string;
  title: string;
  description: string;
  version?: string;
  author?: string;
  url?: string;
  language?: string;
}

export interface IconConfig {
  favicon?: string;
  appleTouchIcon?: string;
  manifestIcon?: string;
  sizes?: string[];
}

export interface SeoDefaults {
  title?: string;
  description?: string;
  keywords?: string[];
  robots?: string;
  openGraph?: {
    siteName?: string;
    type?: string;
    locale?: string;
  };
  twitter?: {
    site?: string;
    creator?: string;
    card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  };
}

export interface LayoutConfig {
  containerMaxWidth?: string;
}

export interface ApiConfig {
  baseUrl: string;
  timeout?: number;
}

export interface AppConfig {
  app: AppMetadata;
  theme: ThemeConfig;
  typography: TypographyConfig;
  icons: IconConfig;
  seo?: SeoDefaults;
  layout?: LayoutConfig;
  api?: ApiConfig;
}
