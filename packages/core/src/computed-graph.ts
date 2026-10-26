import type { Dependency } from './dependencies.js';

interface Edge {
  dependency: Dependency;
  version: number;
  generation: number;
}

/**
 * A computed owns one persistent record per dependency. Re-evaluation updates
 * versions in place, adds new edges, and removes edges omitted by the new branch.
 * Public render captures retain independent Maps of earliest read versions.
 */
export class ComputedGraph {
  private readonly edges = new Map<Dependency, Edge>();
  private order: Edge[] = [];
  private nextOrder: Edge[] | undefined;
  private generation = 0;
  private reads = 0;
  private added: Dependency[] = [];
  private connected = false;

  constructor(
    private readonly attach: (dependency: Dependency) => void,
    private readonly detach: (dependency: Dependency) => void,
  ) {}

  begin(): void {
    this.generation++;
    this.reads = 0;
    this.nextOrder = undefined;
    this.added.length = 0;
  }

  read(dependency: Dependency, version: number): void {
    // Collection traversals usually revisit the same dependencies in the same
    // order. Reuse their records without hashing every property on every pass.
    const expected = this.order[this.reads];
    if (expected?.dependency === dependency) {
      if (expected.generation === this.generation) return;
      expected.version = version;
      expected.generation = this.generation;
      this.nextOrder?.push(expected);
      this.reads++;
      return;
    }
    const edge = this.edges.get(dependency);
    if (edge?.generation === this.generation) return;
    let current: Edge;
    if (edge) {
      edge.version = version;
      edge.generation = this.generation;
      current = edge;
    } else {
      current = { dependency, version, generation: this.generation };
      this.edges.set(dependency, current);
      this.added.push(dependency);
    }
    if (!this.nextOrder && this.reads === this.order.length) this.order.push(current);
    else {
      this.nextOrder ??= this.order.slice(0, this.reads);
      this.nextOrder.push(current);
    }
    this.reads++;
  }

  finish(): void {
    // Identical membership needs no graph walk, even for very large collections.
    if (this.reads !== this.edges.size) {
      for (const [dependency, edge] of this.edges) {
        if (edge.generation !== this.generation) {
          this.edges.delete(dependency);
          if (this.connected) this.detach(dependency);
        }
      }
    }
    if (this.connected) for (const dependency of this.added) this.attach(dependency);
    if (this.nextOrder) this.order = this.nextOrder;
    else this.order.length = this.reads;
    this.nextOrder = undefined;
    this.added.length = 0;
  }

  isStale(): boolean {
    for (const edge of this.order) {
      if (edge.dependency.getVersion() !== edge.version) return true;
    }
    return false;
  }

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    for (const dependency of this.edges.keys()) this.attach(dependency);
  }

  disconnect(): void {
    if (!this.connected) return;
    for (const dependency of this.edges.keys()) this.detach(dependency);
    this.connected = false;
  }
}
