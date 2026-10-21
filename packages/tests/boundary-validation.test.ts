import { describe, expect, it } from 'vitest';
import { Service, ServiceScope, serviceInputs } from '@kinstate/core';
import { readonlyServiceValue } from '../react/src/service-view.js';
import { assertComponentBoundary } from '../react/src/boundaries.js';
import { markReactiveComponent } from '../react/src/component-tracking.js';
import { RenderFrame } from '../react/src/render-frame.js';

const receiver = markReactiveComponent(() => null);

class Data extends Service {
  rows: { name: string }[] = [];
  selected = { name: 'Ada' };
}

describe('component boundary validation', () => {
  it('keeps borrowed payload reads lazy for compiled receivers', () => {
    let enumerations = 0;
    let reads = 0;
    const rows = new Proxy(
      Array.from(
        { length: 1000 },
        (_, id) =>
          new Proxy(
            { name: `User ${id}` },
            {
              get(target, key, owner) {
                if (key === 'name') reads++;
                return Reflect.get(target, key, owner);
              },
              ownKeys(target) {
                enumerations++;
                return Reflect.ownKeys(target);
              },
            },
          ),
      ),
      {
        ownKeys(target) {
          enumerations++;
          return Reflect.ownKeys(target);
        },
      },
    );
    const scope = new ServiceScope([Data], { inputs: [serviceInputs(Data, { rows })] });
    try {
      const view = readonlyServiceValue(scope.get(Data));
      const frame = new RenderFrame();
      expect(frame.boundary(view.rows, 'value', receiver)).toBe(view.rows);
      expect(enumerations).toBe(0);
      expect(reads).toBe(0);
      expect(view.rows[0]!.name).toBe('User 0');
      expect(reads).toBe(1);
      expect(() => Reflect.set(view.rows[0]!, 'name', 'Changed')).toThrow(/read-only/);
    } finally {
      scope.dispose();
    }
  });

  it('passes opaque readonly native data without invoking native methods on a proxy', () => {
    const frame = new RenderFrame();
    const map = readonlyServiceValue(new Map([['row', { name: 'Ada' }]]));
    const set = readonlyServiceValue(new Set(['Ada']));
    expect(frame.boundary(map, 'value', receiver)).toBe(map);
    expect(frame.boundary(set, 'value', receiver)).toBe(set);
    expect(map.get('row')!.name).toBe('Ada');
    expect(set.has('Ada')).toBe(true);
  });

  it('still checks authored async config callbacks beside opaque service data', () => {
    const scope = new ServiceScope([Data]);
    try {
      const view = readonlyServiceValue(scope.get(Data));
      const frame = new RenderFrame();
      const load = frame.callback(
        async () => view.selected.name,
        () => [view.selected],
        true,
      );
      expect(() => frame.boundary({ rows: view.rows, load }, 'value', receiver)).toThrow(
        /primitive/,
      );
    } finally {
      scope.dispose();
    }
  });

  it('rejects deferred live callbacks stored under symbol keys', () => {
    const frame = new RenderFrame();
    const load = frame.callback(
      async () => 'value',
      () => [],
      true,
      true,
    );
    expect(() => frame.boundary({ [Symbol('load')]: load }, 'value', receiver)).toThrow(
      /synchronous/,
    );
  });

  it('checks deferred callbacks inside certified function metadata', () => {
    const frame = new RenderFrame();
    const load = frame.callback(
      async () => 'value',
      () => [],
      true,
      true,
    );
    const format = frame.callback(
      () => 'value',
      () => [],
    );
    Object.defineProperty(format, Symbol('load'), { value: load });
    expect(() => frame.boundary({ format }, 'value', receiver)).toThrow(/synchronous/);
  });

  it('validates symbol metadata on certified snapshot callbacks', () => {
    const scope = new ServiceScope([Data]);
    try {
      const frame = new RenderFrame();
      const format = frame.callback(
        () => 'value',
        () => [],
      );
      Object.defineProperty(format, Symbol('selected'), { value: scope.get(Data).selected });
      expect(() => assertComponentBoundary({ format }, 'value')).toThrow(/Reactive objects/);
    } finally {
      scope.dispose();
    }
  });
});
