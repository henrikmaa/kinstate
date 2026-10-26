import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { collectDependencies, flushSync } from '../src/index.js';
import { PropertyAtoms } from '../src/reactive.js';

function capture(registry: PropertyAtoms, key: PropertyKey) {
  return collectDependencies(() => registry.read(key))
    .dependencies.keys()
    .next().value!;
}

describe('bounded property-entry hot cache', () => {
  it('reuses exact nodes across alternating hot keys and cold-key eviction', () => {
    const registry = new PropertyAtoms();
    const value = capture(registry, 'value');
    const id = capture(registry, 'id');
    for (let i = 0; i < 100; i++) {
      expect(capture(registry, 'value')).toBe(value);
      expect(capture(registry, 'id')).toBe(id);
    }
    for (let i = 0; i < 100; i++) capture(registry, `cold-${i}`);
    registry.changed('value');
    expect(value.getVersion()).toBe(1);
    expect(id.getVersion()).toBe(0);
    expect(capture(registry, 'value')).toBe(value);
    expect(capture(registry, 'id')).toBe(id);
  });

  it('reads updated active/weak ownership from cached entries instead of retaining an Atom snapshot', () => {
    const registry = new PropertyAtoms();
    const value = capture(registry, 'value');
    let calls = 0;
    const stop = value.subscribe(() => {
      calls++;
    });
    capture(registry, 'id');
    registry.changed('value');
    flushSync();
    expect(calls).toBe(1);
    stop();
    registry.changed('value');
    flushSync();
    expect(calls).toBe(1);
    expect(value.getVersion()).toBe(2);
    expect(capture(registry, 'value')).toBe(value);
    const again = value.subscribe(() => {
      calls++;
    });
    registry.changed('value');
    flushSync();
    expect(calls).toBe(2);
    again();
  });

  it('handles symbols, undefined and absent entries without conflating keys or allocating mutation nodes', () => {
    const registry = new PropertyAtoms();
    const missing = undefined as unknown as PropertyKey;
    registry.changed(missing);
    registry.changed('value');
    expect(registry.size).toBe(0);
    const first = Symbol('value'),
      second = Symbol('value');
    const a = capture(registry, first),
      b = capture(registry, second),
      empty = capture(registry, missing);
    registry.changed(first);
    registry.changed(missing);
    expect(a.getVersion()).toBe(1);
    expect(b.getVersion()).toBe(0);
    expect(empty.getVersion()).toBe(1);
    expect(capture(registry, missing)).toBe(empty);
    expect(capture(registry, second)).toBe(b);
    expect(registry.size).toBe(3);
  });

  it('does not keep hot nodes alive and safely recreates them after real finalization', () => {
    const fixture = [
      resolve('packages/core/test/property-atoms-hot-cache.probe.mjs'),
      resolve('test/property-atoms-hot-cache.probe.mjs'),
    ].find(existsSync);
    expect(fixture).toBeDefined();
    const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', fixture!], {
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      originalCollected: 4,
      recreatedCollected: 2,
      entriesAfterGC: 0,
      deliveries: 1,
    });
  });
});
