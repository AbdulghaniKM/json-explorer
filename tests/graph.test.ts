import { describe, expect, it } from 'vitest';
import { buildGraph } from '../src/lib/json/graph';
import { scanJson } from '../src/lib/json/scan';

const layout = (text: string, options = {}) => {
  const scan = scanJson(text);
  if (!scan.ok) throw new Error('scan failed');
  return buildGraph(text, scan.index, options);
};

describe('buildGraph', () => {
  const simple = '{"a":1,"b":{"c":"x"},"d":[10,20]}';

  it('draws a node per value and a link per parent-child pair', () => {
    const graph = layout(simple);
    // root, a, b, b.c, d, d[0], d[1]
    expect(graph.nodes).toHaveLength(7);
    expect(graph.edges).toHaveLength(6);
  });

  it('labels object members by key and array items by position', () => {
    const graph = layout(simple);
    expect(graph.nodes.map((node) => node.label)).toEqual(['$', 'a', 'b', 'c', 'd', '[0]', '[1]']);
  });

  it('places each level in its own column', () => {
    const graph = layout(simple);
    const byLabel = new Map(graph.nodes.map((node) => [node.label, node]));
    expect(byLabel.get('$')?.x).toBe(0);
    expect(byLabel.get('a')?.x).toBe(byLabel.get('b')?.x);
    expect(byLabel.get('c')?.x).toBeGreaterThan(byLabel.get('b')?.x ?? 0);
  });

  it('centres a parent on the children it has', () => {
    const graph = layout('{"p":{"x":1,"y":2}}');
    const parent = graph.nodes.find((node) => node.label === 'p');
    const children = graph.nodes.filter((node) => node.label === 'x' || node.label === 'y');
    const middle = (children[0].y + children[1].y) / 2;
    expect(parent?.y).toBeCloseTo(middle, 5);
  });

  it('carries the leaf value and the child count', () => {
    const graph = layout(simple);
    const a = graph.nodes.find((node) => node.label === 'a');
    const d = graph.nodes.find((node) => node.label === 'd');
    expect(a?.value).toBe('1');
    expect(d?.childCount).toBe(2);
    expect(d?.value).toBe('');
  });

  it('stops at the depth limit and says the branch was trimmed', () => {
    const graph = layout('{"a":{"b":{"c":{"d":1}}}}', { maxDepth: 2 });
    const deepest = graph.nodes.find((node) => node.label === 'b');
    expect(deepest?.truncated).toBe(true);
    expect(graph.truncated).toBe(true);
    expect(graph.nodes.some((node) => node.label === 'd')).toBe(false);
  });

  it('honours the node budget', () => {
    const wide = `[${Array.from({ length: 500 }, (_, i) => i).join(',')}]`;
    const graph = layout(wide, { maxNodes: 40 });
    expect(graph.nodes.length).toBeLessThanOrEqual(41);
    expect(graph.truncated).toBe(true);
    expect(graph.shown).toBe(graph.nodes.length);
  });

  it('reports an untrimmed document as complete', () => {
    const graph = layout(simple, { maxDepth: 10, maxNodes: 100 });
    expect(graph.truncated).toBe(false);
    expect(graph.shown).toBe(graph.total);
  });

  it('gives a scalar root a usable canvas', () => {
    const graph = layout('42');
    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
    expect(graph.width).toBeGreaterThan(0);
    expect(graph.height).toBeGreaterThan(0);
  });

  it('does not overflow the stack on pathological nesting', () => {
    // Just under the scanner's own depth cap, so this exercises the layout, not the scan.
    const deep = '['.repeat(9_000) + '1' + ']'.repeat(9_000);
    expect(() => layout(deep, { maxDepth: 50 })).not.toThrow();
  });

  it('keeps every drawn node inside the reported canvas', () => {
    const graph = layout('{"a":[1,2,3],"b":{"c":{"d":[4,5]}}}', { maxDepth: 6 });
    for (const node of graph.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThan(graph.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThan(graph.height);
    }
  });

  it('links only nodes it actually drew', () => {
    const graph = layout('{"a":{"b":{"c":1}}}', { maxDepth: 2 });
    const ids = new Set(graph.nodes.map((node) => node.id));
    for (const edge of graph.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });
});
