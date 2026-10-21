import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Service } from '@kinstate/core';
import { readonlyServiceValue } from '../react/src/service-view.js';

describe('readonly consumer method ownership', () => {
  it('releases removed callback closures while the consumer remains alive through real GC', () => {
    const fixture = resolve('packages/tests/service-view-retention.probe.mjs');
    const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', fixture], {
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ removed: 500, retained: 0 });
  });

  it('retains stable identities through callback replacement, aliases and native reads', () => {
    class Store extends Service {
      callback = () => 1;
      rows = [{ id: 1 }];
      entries = new Map([['one', 1]]);
    }
    const source = new Store();
    const view = readonlyServiceValue(source);
    const initial = view.callback;
    expect(view.callback).toBe(initial);
    source.callback = () => 2;
    expect(view.callback).not.toBe(initial);
    expect(view.callback()).toBe(2);
    expect(initial()).toBe(1);
    expect(view.rows.map).toBe(view.rows.map);
    expect(view.entries.get).toBe(view.entries.get);
    expect(view.entries.entries).toBe(view.entries.entries);
    expect([...view.entries.entries()]).toEqual([['one', 1]]);
    expect(() => (view.entries as unknown as Map<string, number>).set('two', 2)).toThrow(
      /read-only/,
    );
    expect(source.entries.size).toBe(1);
    const entries = source.entries as Map<string, number> & { alias?: typeof source.entries.get };
    entries.alias = entries.get;
    const consumerEntries = view.entries as typeof entries;
    expect(() => consumerEntries.alias!('one')).toThrow(/Opaque nested/);
    expect(view.entries.get('one')).toBe(1);
    expect(view.entries[Symbol.iterator]).toBe(view.entries.entries);
  });
});
