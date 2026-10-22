import { describe, expect, it } from 'vitest';
import type { Dependency } from '@kinstate/core';
import { MemoCache } from '../../react/src/memo-cache.js';

describe('memo cache external-store ownership', () => {
  it('rolls back a failed first subscription so a subsequent listener connects', () => {
    const cache = new MemoCache();
    let calls = 0,
      cleanups = 0;
    const dependency: Dependency = {
      getVersion: () => 0,
      subscribe: () => {
        calls++;
        if (calls === 1) throw new Error('subscription failed');
        return () => {
          cleanups++;
        };
      },
    };
    cache.publish(new Map([[dependency, 0]]));
    expect(() => cache.subscribe(() => undefined)).toThrow('subscription failed');
    const stop = cache.subscribe(() => undefined);
    expect(calls).toBe(2);
    stop();
    expect(cleanups).toBe(1);
  });

  it('keeps snapshots stable until source versions change and catches a publish race', () => {
    const cache = new MemoCache();
    let version = 0;
    const dependency: Dependency = { getVersion: () => version, subscribe: () => () => undefined };
    const initial = cache.getSnapshot();
    cache.publish(new Map([[dependency, 0]]));
    expect(cache.getSnapshot()).toBe(initial);
    expect(cache.getSnapshot()).toBe(initial);
    version++;
    const changed = cache.getSnapshot();
    expect(changed).not.toBe(initial);
    expect(cache.getSnapshot()).toBe(changed);
    cache.publish(new Map([[dependency, version]]));
    expect(cache.getSnapshot()).toBe(changed);
    cache.publish(new Map([[dependency, version - 1]]));
    expect(cache.getSnapshot()).not.toBe(changed);
  });
});
