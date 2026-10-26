import { describe, expect, it } from 'vitest';
import type { Dependency } from '../src/dependencies.js';
import { ComputedGraph } from '../src/computed-graph.js';

function source() {
  return {
    version: 0,
    getVersion() {
      return this.version;
    },
    subscribe() {
      return () => {};
    },
  };
}
function fixture() {
  const connected = new Set<Dependency>();
  const graph = new ComputedGraph(
    (dep) => {
      connected.add(dep);
    },
    (dep) => {
      connected.delete(dep);
    },
  );
  function collect(dependencies: Dependency[]) {
    graph.begin();
    for (const dep of dependencies) graph.read(dep, dep.getVersion());
    graph.finish();
  }
  return { graph, connected, collect };
}

describe('computed dependency traversal order', () => {
  it('preserves dynamic membership through reordered, duplicate and shrinking reads', () => {
    const a = source(),
      b = source(),
      c = source(),
      d = source();
    const { graph, connected, collect } = fixture();
    collect([a, b, c]);
    graph.connect();
    for (const order of [[a, b, c], [c, a, b], [c, a, a, d, b], [a, d], [d], []]) {
      collect(order);
      expect([...connected]).toHaveLength(new Set(order).size);
      for (const dep of order) expect(connected.has(dep)).toBe(true);
      expect(graph.isStale()).toBe(false);
    }
    a.version++;
    b.version++;
    c.version++;
    d.version++;
    expect(graph.isStale()).toBe(false);
  });

  it('validates the current sources after order changes and appended dependencies', () => {
    const a = source(),
      b = source(),
      c = source();
    const { graph, collect } = fixture();
    for (const order of [[a], [a, b], [b, a, c], [c, a], [a, c]]) {
      collect(order);
      a.version++;
      expect(graph.isStale()).toBe(true);
      collect(order);
      expect(graph.isStale()).toBe(false);
    }
  });

  it('retains the earliest version if a source changes between duplicate reads', () => {
    const a = source(),
      b = source();
    const { graph, collect } = fixture();
    collect([a, b]);
    graph.begin();
    graph.read(b, b.getVersion());
    b.version++;
    graph.read(a, a.getVersion());
    graph.read(b, b.getVersion());
    graph.finish();
    expect(graph.isStale()).toBe(true);
    collect([b, a]);
    expect(graph.isStale()).toBe(false);
  });

  it('reconnects only the retained sources after a disconnected traversal', () => {
    const a = source(),
      b = source(),
      c = source();
    const { graph, connected, collect } = fixture();
    collect([a, b]);
    graph.connect();
    graph.disconnect();
    collect([c, a]);
    graph.connect();
    expect(connected).toEqual(new Set([c, a]));
    graph.disconnect();
    expect(connected.size).toBe(0);
  });
});
