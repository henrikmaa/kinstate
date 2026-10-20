import type { Dependency } from './dependencies.js';

interface Edge {
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
    this.added.length = 0;
  }

  read(dependency: Dependency, version: number): void {
    const edge = this.edges.get(dependency);
    if (edge?.generation === this.generation) return;
    if (edge) {
      edge.version = version;
      edge.generation = this.generation;
    } else {
      this.edges.set(dependency, { version, generation: this.generation });
      this.added.push(dependency);
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
    this.added.length = 0;
  }

  isStale(): boolean {
    for (const [dependency, edge] of this.edges) {
      if (dependency.getVersion() !== edge.version) return true;
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
