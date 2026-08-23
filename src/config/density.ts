/**
 * The measurements CSS and the virtualizers have to agree on, in one place.
 *
 * `VirtualTree` and `LineViewer` need plain numbers to do their windowing maths, while the
 * templates need CSS custom properties. Keeping both derived from this object is what stops
 * a row height and its `line-height` drifting apart — a disagreement that shows up as
 * progressively worse scroll desync the further down a large document you go.
 *
 * Every value is in CSS pixels so `parseFloat` round-trips exactly and no rem scaling can
 * creep in between the two consumers.
 */
export interface DensityScale {
  /** Sticky header. The panel heights on every page are derived from it. */
  headerHeight: number;
  /** One row in the tree virtualizer. */
  treeRowHeight: number;
  /** One line of code, everywhere: editor gutter, highlight overlay, textarea, line viewer. */
  codeLineHeight: number;
  codeFontSize: number;
  /** One level of nesting in the tree, diff and line guides. */
  indentWidth: number;
  /** Buttons, inputs and selects. */
  controlHeight: number;
}

export const DENSITY: DensityScale = {
  headerHeight: 56,
  treeRowHeight: 26,
  codeLineHeight: 20,
  codeFontSize: 13,
  indentWidth: 14,
  controlHeight: 32,
};

/**
 * Mirrored by the literals in `:root` in `style.css`, which cover the frame before this is
 * injected. A mismatch there costs one frame of the wrong metrics, never a desync.
 */
export const DENSITY_VARIABLES: Record<string, string> = {
  '--header-h': `${DENSITY.headerHeight}px`,
  '--row-h': `${DENSITY.treeRowHeight}px`,
  '--code-line': `${DENSITY.codeLineHeight}px`,
  '--code-size': `${DENSITY.codeFontSize}px`,
  '--indent-width': `${DENSITY.indentWidth}px`,
  '--control-h': `${DENSITY.controlHeight}px`,
};
