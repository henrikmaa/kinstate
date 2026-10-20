import { describe, expect, it, vi } from 'vitest';
import { Service, collectDependencies, flushSync, isReactive, observe } from '../src/index.js';
import { PropertyAtoms } from '../src/reactive.js';
import { Atom } from '../src/dependencies.js';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

function oneDependency(registry: PropertyAtoms, key: string) {
  const capture = collectDependencies(() => registry.read(key));
  return [...capture.dependencies][0]!;
}

describe('property dependency ownership', () => {
  it('reclaims released observed keys while retaining captured render dependencies through real GC', () => {
    const fixture = [
      resolve('packages/core/test/retention.probe.mjs'),
      resolve('test/retention.probe.mjs'),
    ].find(existsSync);
    expect(fixture).toBeDefined();
    const result = spawnSync(process.execPath, ['--expose-gc', '--import', 'tsx', fixture!], {
      encoding: 'utf8',
      timeout: 30000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    const probe = JSON.parse(result.stdout);
    expect(probe.observedEntriesBeforeGC).toBe(25000);
    expect(probe.observedEntriesAfterGC).toBe(0);
    expect(probe.retainedCapturedEntries).toBe(1);
    expect(probe.plainEffects).toBe(2);
    expect(probe.computedEffects).toBe(2);
    expect(probe.directDeliveries).toBe(1);
    expect(probe.releasedDirectEntries).toBe(0);
  });
  it('does not allocate atoms for unobserved reads or mutation churn', () => {
    const registry = new PropertyAtoms();
    for (let index = 0; index < 10000; index++) {
      const key = `item-${index}`;
      registry.read(key);
      registry.changed(key);
      registry.changed(key);
    }
    expect(registry.size).toBe(0);
  });

  it('preserves captured node identity and versions through delete and reinsert before subscription', () => {
    const registry = new PropertyAtoms();
    const [dependency, version] = oneDependency(registry, 'item');
    registry.changed('item'); // delete
    registry.changed('item'); // reinsert
    expect(dependency.getVersion()).not.toBe(version);
    expect(oneDependency(registry, 'item')[0]).toBe(dependency);
    const listener = vi.fn();
    const stop = dependency.subscribe(listener);
    registry.changed('item');
    flushSync();
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });

  it('cancels pending deliveries on unsubscribe without resetting a captured dependency version', () => {
    const registry = new PropertyAtoms();
    const [dependency, version] = oneDependency(registry, 'item');
    const listener = vi.fn();
    const stop = dependency.subscribe(listener);
    registry.changed('item');
    stop();
    flushSync();
    expect(listener).not.toHaveBeenCalled();
    expect(dependency.getVersion()).not.toBe(version);
    expect(oneDependency(registry, 'item')[0]).toBe(dependency);
    const resubscribe = dependency.subscribe(listener);
    registry.changed('item');
    flushSync();
    expect(listener).toHaveBeenCalledTimes(1);
    resubscribe();
  });

  it('notifies captured actual record dependencies across deletion and same-value reinsertion', () => {
    class Records extends Service {
      items: Record<string, number> = { item: 1 };
    }
    const service = new Records();
    const captured = collectDependencies(() => [service.items.item, 'item' in service.items]);
    delete service.items.item;
    service.items.item = 1;
    expect([...captured.dependencies].some(([dep, version]) => dep.getVersion() !== version)).toBe(
      true,
    );
    const value = vi.fn(() => service.items.item);
    const stop = observe(value);
    delete service.items.item;
    flushSync();
    service.items.item = 2;
    flushSync();
    expect(value.mock.results.map((result) => result.value)).toEqual([1, undefined, 2]);
    stop();
  });
});

describe('lazy computed validation', () => {
  it('shares an unchanged computed graph across subscribers without reconnecting every source', () => {
    class Counter extends Service {
      count = 1;
      get doubled() {
        return this.count * 2;
      }
    }
    const service = new Counter();
    const dependency = [...collectDependencies(() => service.count).dependencies.keys()][0] as Atom;
    const add = vi.spyOn(dependency.watchers, 'add');
    const remove = vi.spyOn(dependency.watchers, 'delete');
    const captured = collectDependencies(() => service.doubled);
    const subscribe = () => {
      const stops = [...captured.dependencies.keys()].map((dependency) =>
        dependency.subscribe(() => {}),
      );
      return () => stops.forEach((stop) => stop());
    };
    const first = subscribe();
    expect(add).toHaveBeenCalledTimes(1);
    const second = subscribe();
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    first();
    service.count = 2;
    flushSync();
    expect(service.doubled).toBe(4);
    expect(add).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
    second();
    flushSync();
    expect(remove).toHaveBeenCalledTimes(1);
    expect(dependency.watchers.size).toBe(0);
  });
  it('validates unchanged dependencies once per mutation checkpoint, including after unrelated unobserved writes', () => {
    let evaluations = 0;
    class Counter extends Service {
      count = 1;
      unrelated = 0;
      get doubled() {
        evaluations++;
        return this.count * 2;
      }
    }
    const service = new Counter();
    const dependency = [...collectDependencies(() => service.count).dependencies.keys()][0]!;
    const getVersion = vi.spyOn(dependency, 'getVersion');
    expect(service.doubled).toBe(2);
    getVersion.mockClear();
    for (let index = 0; index < 100; index++) expect(service.doubled).toBe(2);
    expect(getVersion).not.toHaveBeenCalled();
    service.unrelated++;
    expect(service.doubled).toBe(2);
    expect(getVersion).toHaveBeenCalledTimes(1);
    expect(service.doubled).toBe(2);
    expect(getVersion).toHaveBeenCalledTimes(1);
    service.count = 2;
    expect(service.doubled).toBe(4);
    expect(evaluations).toBe(2);
  });

  it('keeps chained computed equality, conditional dependencies, failures and detached reads correct', () => {
    let upperCalls = 0;
    class Chain extends Service {
      count = 0;
      alternate = 7;
      active = true;
      get parity() {
        return this.count % 2;
      }
      get upper() {
        upperCalls++;
        return this.active ? this.parity + 10 : this.alternate;
      }
    }
    const service = new Chain();
    const seen: number[] = [];
    const stop = observe(() => seen.push(service.upper));
    service.count = 2;
    flushSync();
    expect(seen).toEqual([10]);
    expect(upperCalls).toBe(1);
    service.count = 3;
    flushSync();
    expect(seen).toEqual([10, 11]);
    service.active = false;
    flushSync();
    service.count = 4;
    flushSync();
    expect(seen).toEqual([10, 11, 7]);
    stop();
    service.alternate = 9;
    expect(service.upper).toBe(9);
  });
});

describe('canonical reactive introspection', () => {
  it('identifies only this runtime canonical proxies without cloning or wrapping opaque values', () => {
    const raw = { value: 1 };
    const frozen = Object.freeze({ value: 2 });
    const native = new Map();
    class Values extends Service {
      nested = raw;
      rows = [raw];
      frozen = frozen;
      native = native;
    }
    const service = new Values();
    expect(isReactive(service)).toBe(true);
    expect(isReactive(service.nested)).toBe(true);
    expect(isReactive(service.rows)).toBe(true);
    expect(isReactive(service.rows[0])).toBe(true);
    expect(service.nested).toBe(service.rows[0]);
    for (const value of [
      raw,
      frozen,
      native,
      service.frozen,
      service.native,
      undefined,
      null,
      1,
      () => {},
    ]) {
      expect(isReactive(value)).toBe(false);
    }
    Object.preventExtensions(service.nested);
    expect(isReactive(service.nested)).toBe(true);
    expect(isReactive(new Proxy(service, {}))).toBe(false);
  });
});
