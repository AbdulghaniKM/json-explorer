import type { JsonValueType } from '@/lib/json';

/**
 * Chart palettes, computed rather than picked.
 *
 * Two things make these values look arbitrary, and neither is:
 *
 * 1. They start from this app's own syntax-token hues — a string is green in the editor, so it
 *    is green in the chart — snapped into the OKLCH lightness band and chroma floor a large
 *    fill needs. The raw token colours fail badly as fills: `#00e05c` on `#191a1c` sits at
 *    L 0.79, far above the band, and green↔yellow collapse to ΔE 3.0 under protanopia.
 * 2. **They are pre-compensated for ApexCharts' 0.85 fill alpha.** The library paints bar
 *    fills at `rgba(…, 0.85)` over the surface and ignores `fill.opacity`, so the hex authored
 *    here is not the colour a reader sees. Each value below is the solution of
 *    `rendered = 0.85 × authored + 0.15 × surface` for the rendered colour that passes, which
 *    is why they read brighter than expected in isolation.
 *
 * Every set was checked with the dataviz validator against its own surface — lightness band,
 * chroma floor, colour-vision separation (Machado 2009, severity 1.0), the normal-vision
 * floor, and WCAG contrast. Re-derive rather than hand-edit: changing one hex by eye breaks
 * the compensation and the checks at the same time.
 */

/**
 * Slot order for the value-type composition bar, and the reason it is neither alphabetical nor
 * count-sorted: adjacency is what the colour-vision check measures, and this permutation is
 * the one that clears it in BOTH themes — worst adjacent pair ΔE 18.2 dark, 23.2 light,
 * against a target of 8. The legend renders in this same order so a reader can map the two,
 * and colour stays bound to the value type rather than to its current rank.
 */
export const VALUE_TYPE_SLOTS: JsonValueType[] = [
  'object',
  'array',
  'string',
  'boolean',
  'number',
  'null',
];

/**
 * One fill per slot above. `null` is deliberately the neutral remainder rather than a sixth
 * identity hue: it is the absence of a value, and forcing it past the chroma floor turned it
 * into the loudest colour on the panel. It is the only slot the chroma check flags.
 *
 * Rendered, these are `#0ca1b2 #4c57a9 #327740 #db4fbb #aa8c0f #636975` on dark and
 * `#42bdd2 #3141ca #47b86d #892e76 #d6a13c #666c78` on light. A few of those sit just under
 * 3:1 against their surface, which the method allows only when the values are legible another
 * way — here the legend beneath the bar names every type with its count and percentage.
 */
export const VALUE_TYPE_FILLS: Record<'light' | 'dark', string[]> = {
  dark: ['#0ab9cc', '#5562c2', '#368746', '#fd58d7', '#c4a00d', '#707785'],
  light: ['#21b1ca', '#0d1fc1', '#27ab53', '#74095e', '#cf901a', '#4b5260'],
};

/**
 * The same slots as they actually appear, for the legend swatches. A swatch is plain CSS with
 * no 0.85 blend applied, so painting it with the authored hex would make the key disagree with
 * the bar it explains — these are the validated colours the chart resolves to.
 */
export const VALUE_TYPE_SWATCHES: Record<'light' | 'dark', string[]> = {
  dark: ['#0ca1b2', '#4c57a9', '#327740', '#db4fbb', '#aa8c0f', '#636975'],
  light: ['#42bdd2', '#3141ca', '#47b86d', '#892e76', '#d6a13c', '#666c78'],
};

/**
 * Raw → minified → gzip is one measure getting smaller, not three identities, so it takes an
 * ordinal ramp: a single hue with monotone lightness and a ΔL of at least 0.06 between steps.
 * The direction flips with the surface — more reads darker on white, lighter on black.
 */
export const SIZE_RAMP: Record<'light' | 'dark', string[]> = {
  dark: ['#0deb67', '#05be50', '#10903d'],
  light: ['#015d21', '#048936', '#02b84c'],
};

/**
 * The single-series fill, for charts whose job is magnitude rather than identity. Calmer than
 * `--primary`: a large fill of `#00e05c` glares and fails the lightness band.
 */
export const SERIES_FILL: Record<'light' | 'dark', string> = {
  light: '#0f7a3d',
  dark: '#16a34a',
};
