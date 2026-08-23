import { NODE_ARRAY, NODE_OBJECT, type JsonIndex } from './scan';
import { rawTextOf } from './tree';

/**
 * A node-link layout of the document, built straight from the flat index.
 *
 * Iterative throughout, like the rest of the index-based tools: the documents this app is for
 * nest deeper than a recursive layout survives, and a graph that throws on the file you most
 * wanted to see is worse than no graph. Two passes — one down to place columns, one up to
 * centre parents over their children — which is the simplified Reingold-Tilford arrangement.
 */

export interface GraphNode {
  id: number;
  x: number;
  y: number;
  depth: number;
  label: string;
  value: string;
  type: number;
  childCount: number;
  /** Children exist but were left out by the node budget or the depth limit. */
  truncated: boolean;
}

export interface GraphEdge {
  from: number;
  to: number;
}

export interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width: number;
  height: number;
  shown: number;
  total: number;
  truncated: boolean;
}

export interface GraphOptions {
  /** Levels to draw. Past it a node is drawn as a leaf and marked truncated. */
  maxDepth?: number;
  /** Hard ceiling on drawn nodes, so a million-node document still answers. */
  maxNodes?: number;
  columnWidth?: number;
  rowHeight?: number;
}

const LABEL_CHARS = 28;
const VALUE_CHARS = 32;

const DEFAULTS: Required<GraphOptions> = {
  maxDepth: 4,
  maxNodes: 600,
  columnWidth: 210,
  rowHeight: 34,
};

const clip = (text: string, limit: number): string =>
  text.length > limit ? `${text.slice(0, limit - 1)}…` : text;

const labelFor = (text: string, index: JsonIndex, id: number): string => {
  const start = index.keyStart[id];
  const end = index.keyEnd[id];
  if (end > start) return clip(text.slice(start, end), LABEL_CHARS);

  const parent = index.parent[id];
  if (parent < 0) return '$';
  return index.type[parent] === NODE_ARRAY ? `[${index.childIndex[id]}]` : '·';
};

export const buildGraph = (
  text: string,
  index: JsonIndex,
  options: GraphOptions = {},
): GraphLayout => {
  const { maxDepth, maxNodes, columnWidth, rowHeight } = { ...DEFAULTS, ...options };

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const slotOf = new Map<number, number>();

  if (index.count === 0) {
    return { nodes, edges, width: 0, height: 0, shown: 0, total: 0, truncated: false };
  }

  // Pass one: a pre-order walk that assigns every drawn node its column, and every leaf a row.
  // An explicit stack rather than recursion — depth here is the document's, not ours to pick.
  const stack: number[] = [0];
  const order: number[] = [];
  let nextRow = 0;
  let truncated = false;

  while (stack.length) {
    // The budget has to bind on what gets drawn, not only on what gets expanded: a single
    // array of a hundred thousand items would otherwise be pushed whole before the first
    // expansion check ever ran.
    if (nodes.length >= maxNodes) {
      truncated = true;
      break;
    }

    const id = stack.pop() as number;
    const depth = index.depth[id];
    const container = index.type[id] === NODE_OBJECT || index.type[id] === NODE_ARRAY;
    const childCount = index.childCount[id];

    const room = maxNodes - nodes.length - stack.length;
    const expandable = container && childCount > 0;
    const expands = expandable && depth < maxDepth && room > 0;
    if (expandable && !expands) truncated = true;

    slotOf.set(id, nodes.length);
    order.push(id);
    nodes.push({
      id,
      x: depth * columnWidth,
      y: expands ? 0 : nextRow++ * rowHeight,
      depth,
      label: labelFor(text, index, id),
      value: container ? '' : clip(rawTextOf(text, index, id, VALUE_CHARS + 4), VALUE_CHARS),
      type: index.type[id],
      childCount,
      truncated: expandable && !expands,
    });

    if (!expands) continue;

    const children: number[] = [];
    for (let child = id + 1; child < index.count; child++) {
      if (index.parent[child] !== id) continue;
      children.push(child);
      if (children.length >= childCount) break;
    }

    // Take only what the budget still has room for, and say so when some are left out.
    const drawn = Math.min(children.length, room);
    if (drawn < children.length) {
      truncated = true;
      nodes[nodes.length - 1].truncated = true;
    }

    // Push in reverse so the pop order matches document order.
    for (let i = drawn - 1; i >= 0; i--) {
      edges.push({ from: id, to: children[i] });
      stack.push(children[i]);
    }
  }

  // Pass two: walk back up the pre-order so every parent is centred on the children it now
  // has. Reverse order guarantees each node's children are already placed.
  const childRange = new Map<number, { min: number; max: number }>();
  for (let position = order.length - 1; position >= 0; position--) {
    const id = order[position];
    const range = childRange.get(id);
    const node = nodes[slotOf.get(id) as number];
    if (range) node.y = (range.min + range.max) / 2;

    const parent = index.parent[id];
    if (parent < 0 || !slotOf.has(parent)) continue;
    const existing = childRange.get(parent);
    childRange.set(
      parent,
      existing
        ? { min: Math.min(existing.min, node.y), max: Math.max(existing.max, node.y) }
        : { min: node.y, max: node.y },
    );
  }

  const width = Math.max(...nodes.map((node) => node.x)) + columnWidth;
  const height = Math.max(rowHeight, Math.max(...nodes.map((node) => node.y)) + rowHeight);

  return {
    nodes,
    edges,
    width,
    height,
    shown: nodes.length,
    total: index.count,
    truncated: truncated || nodes.length < index.count,
  };
};
