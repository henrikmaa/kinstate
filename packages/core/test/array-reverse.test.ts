import { describe, expect, it } from 'vitest';
import { Service, collectDependencies, flushSync, observe } from '../src/index.js';
import { registerReadonlyView } from '../src/internal.js';

class State<T = unknown> extends Service {
  constructor(public rows: T[]) {
    super();
  }
}

function versions(read: () => unknown) {
  const captured = collectDependencies(read).dependencies;
  return new Map([...captured.keys()].map((dependency) => [dependency, dependency.getVersion()]));
}
function changed(before: ReturnType<typeof versions>) {
  return [...before].filter(([dependency, version]) => dependency.getVersion() !== version);
}

/** Reflect visible data and attributes without reading getters. */
function shape(value: unknown[]) {
  return Reflect.ownKeys(value).map((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
    return [
      key,
      descriptor.value,
      descriptor.writable,
      descriptor.enumerable,
      descriptor.configurable,
      descriptor.get,
      descriptor.set,
    ];
  });
}

describe('native dense array reversal', () => {
  it('updates changed positions and one sequence, keeping length, existence, keys and equal positions stable', () => {
    const state = new State([1, 2, 3]);
    const seen = {
      first: [] as number[],
      middle: [] as number[],
      keys: [] as string[],
      exists: [] as boolean[],
      length: [] as number[],
      sequence: [] as string[],
    };
    const stops = [
      observe(() => {
        seen.first.push(state.rows[0]!);
      }),
      observe(() => {
        seen.middle.push(state.rows[1]!);
      }),
      observe(() => {
        seen.keys.push(Object.keys(state.rows).join(','));
      }),
      observe(() => {
        seen.exists.push(0 in state.rows);
      }),
      observe(() => {
        seen.length.push(state.rows.length);
      }),
      observe(() => {
        seen.sequence.push(state.rows.map((value) => value).join(','));
      }),
    ];
    const before = versions(() => state.rows.map((value) => value));
    expect(state.rows.reverse()).toBe(state.rows);
    flushSync();
    expect(seen).toEqual({
      first: [1, 3],
      middle: [2],
      keys: ['0,1,2'],
      exists: [true],
      length: [3],
      sequence: ['1,2,3', '3,2,1'],
    });
    const invalidated = changed(before);
    expect(invalidated).toHaveLength(1);
    expect(invalidated[0]![0].getVersion() - invalidated[0]![1]).toBe(1);
    stops.forEach((stop) => stop());
  });

  it.each(
    [[], [1], [1, 2, 1], [Number.NaN, undefined, Number.NaN], [0, 0]].map((input) => ({ input })),
  )('does not invalidate Object.is palindromes: %j', ({ input }) => {
    const state = new State(input);
    const before = versions(() => [
      state.rows[0],
      state.rows.map((value) => value),
      Object.keys(state.rows),
      state.rows.length,
    ]);
    expect(state.rows.reverse()).toBe(state.rows);
    expect(changed(before)).toHaveLength(0);
  });

  it('distinguishes positive and negative zero', () => {
    const state = new State([0, -0]);
    const before = versions(() => state.rows[0]);
    state.rows.reverse();
    expect(Object.is(state.rows[0], -0)).toBe(true);
    expect(Object.is(state.rows[1], 0)).toBe(true);
    expect(changed(before)).toHaveLength(1);
  });

  it('invalidates inactive captured index nodes and lazy computed values', () => {
    let evaluations = 0;
    class ComputedState extends State<number> {
      get head() {
        evaluations++;
        return this.rows[0];
      }
      get sequence() {
        return this.rows.map((value) => value).join(',');
      }
    }
    const state = new ComputedState([1, 2, 3]);
    expect(state.head).toBe(1);
    expect(state.sequence).toBe('1,2,3');
    const captured = versions(() => state.rows[2]);
    state.rows.reverse();
    expect(changed(captured)).toHaveLength(1);
    expect(state.head).toBe(3);
    expect(state.sequence).toBe('3,2,1');
    expect(evaluations).toBe(2);
  });

  it('preserves cached method references, native function properties and foreign .call receivers', () => {
    const state = new State([1, 2, 3]);
    const reverse = state.rows.reverse;
    expect(reverse).toBe(state.rows.reverse);
    expect(reverse.name).toBe('reverse');
    expect(reverse.length).toBe(0);
    expect(reverse.call(state.rows)).toBe(state.rows);
    const other = [4, 5];
    expect(reverse.call(other)).toBe(other);
    expect(other).toEqual([5, 4]);
    expect(() => reverse()).toThrow(TypeError);
    expect(() => Reflect.construct(reverse, [])).toThrow(TypeError);
  });

  it('respects overrides and fixed native method identities', () => {
    const values = [1, 2];
    let receiver: unknown;
    Object.defineProperty(values, 'reverse', {
      value: function () {
        receiver = this;
        return 'custom';
      },
      configurable: true,
    });
    const state = new State(values);
    expect(state.rows.reverse()).toBe('custom');
    expect(receiver).toBe(state.rows);
    const fixed = [1, 2];
    Object.defineProperty(fixed, 'reverse', {
      value: Array.prototype.reverse,
      configurable: false,
      writable: false,
    });
    const fixedState = new State(fixed);
    expect(fixedState.rows.reverse).toBe(Array.prototype.reverse);
    fixedState.rows.reverse();
    expect([...fixedState.rows]).toEqual([2, 1]);
  });

  it('keeps native proxy reads observable inside a collector', () => {
    const state = new State([1, 2, 3]);
    const captured = collectDependencies(() => state.rows.reverse());
    const before = new Map(
      [...captured.dependencies.keys()].map((node) => [node, node.getVersion()]),
    );
    state.rows[0] = 9;
    expect(changed(before)).toHaveLength(1);
  });

  it('keeps foreign reactive receivers observable and returns generic native receivers', () => {
    const state = new State([1, 2]);
    const other = new State([8, 9]);
    const seen: number[] = [];
    const stop = observe(() => {
      seen.push(other.rows[0]!);
    });
    const reverse = state.rows.reverse;
    expect(reverse.call(other.rows)).toBe(other.rows);
    flushSync();
    expect(seen).toEqual([8, 9]);
    const generic = { 0: 'left', 1: 'right', length: 2 };
    expect(reverse.call(generic as unknown as number[])).toBe(generic);
    expect(generic).toEqual({ 0: 'right', 1: 'left', length: 2 });
    stop();
  });

  it('never gives readonly consumer receivers a raw mutation capability', () => {
    const state = new State([1, 2, 3]);
    const reverse = state.rows.reverse;
    const readonly = new Proxy(state.rows, {
      set() {
        throw new TypeError('Readonly');
      },
      deleteProperty() {
        throw new TypeError('Readonly');
      },
    });
    registerReadonlyView(readonly, state.rows);
    expect(() => reverse.call(readonly)).toThrow('Readonly');
    expect([...state.rows]).toEqual([1, 2, 3]);
  });

  it('does not expose raw element state or skip existing input normalization', () => {
    class Models extends Service {
      object = { id: 1 };
      rows: { id: number }[] = [];
    }
    const state = new Models();
    const element = state.object;
    state.rows = [element, { id: 2 }];
    const reverse = state.rows.reverse;
    expect(reverse.call(state.rows)).toBe(state.rows);
    expect(state.rows[1]).toBe(element);
  });
});

describe('array reverse native fallbacks', () => {
  it.each([[1, , 3, 4], [, undefined, 3], Array(4)].map((input) => ({ input })))(
    'retains holes, ownership and key order: %j',
    ({ input }) => {
      const expected = input.slice();
      const state = new State(input.slice());
      expected.reverse();
      state.rows.reverse();
      expect(shape(state.rows)).toEqual(shape(expected));
    },
  );

  it('publishes sparse key and existence changes through the native fallback', () => {
    const state = new State([1, , 3, 4]);
    const seen: { keys: string[]; exists: boolean[] } = { keys: [], exists: [] };
    const stops = [
      observe(() => {
        seen.keys.push(Object.keys(state.rows).join(','));
      }),
      observe(() => {
        seen.exists.push(1 in state.rows);
      }),
    ];
    state.rows.reverse();
    flushSync();
    expect(seen).toEqual({ keys: ['0,2,3', '0,1,3'], exists: [false, true] });
    stops.forEach((stop) => stop());
  });

  it('uses canonical getter/setter receivers and ordinary reverse access order', () => {
    function setup(trace: unknown[]) {
      const input = Object.assign([1, 2, 3, 4], { backing: 1 });
      Object.defineProperty(input, '0', {
        configurable: true,
        enumerable: true,
        get() {
          trace.push(['get', this]);
          return (this as typeof input).backing;
        },
        set(next) {
          trace.push(['set', this, next]);
          (this as typeof input).backing = next;
        },
      });
      return input;
    }
    const expectedTrace: unknown[] = [];
    const expected = setup(expectedTrace);
    const actualTrace: unknown[] = [];
    const state = new State(setup(actualTrace));
    expected.reverse();
    state.rows.reverse();
    expect(actualTrace.map((entry) => (entry as unknown[]).filter((_, i) => i !== 1))).toEqual(
      expectedTrace.map((entry) => (entry as unknown[]).filter((_, i) => i !== 1)),
    );
    for (const entry of actualTrace) expect((entry as unknown[])[1]).toBe(state.rows);
    expect([...state.rows]).toEqual([...expected]);
  });

  it('revalidates canonical descriptor changes after an earlier successful dense reverse', () => {
    const input = [1, 2, 3, 4];
    const state = new State(input);
    state.rows.reverse();
    const backing = state.rows as typeof input & { backing: number };
    backing.backing = state.rows[0]!;
    const receivers: unknown[] = [];
    Object.defineProperty(state.rows, '0', {
      configurable: true,
      enumerable: true,
      get() {
        receivers.push(this);
        return (this as typeof backing).backing;
      },
      set(next) {
        receivers.push(this);
        (this as typeof backing).backing = next;
      },
    });
    state.rows.reverse();
    expect(receivers).toHaveLength(2);
    expect(receivers.every((receiver) => receiver === state.rows)).toBe(true);
    expect([...state.rows]).toEqual([1, 2, 3, 4]);
  });

  it('revalidates a canonical hole and inherited index introduced between calls', () => {
    const input = [1, 2, 3];
    const state = new State(input);
    state.rows.reverse();
    delete state.rows[0];
    const prototype = Object.create(Array.prototype);
    Object.defineProperty(prototype, '0', { value: 7, writable: true, configurable: true });
    Object.setPrototypeOf(state.rows, prototype);
    state.rows.reverse();
    expect(Array.from(state.rows)).toEqual([1, 2, 7]);
    expect(Object.hasOwn(state.rows, '0')).toBe(true);
    expect(Object.hasOwn(state.rows, '2')).toBe(true);
  });

  it('retains partial native failure behavior for readonly/custom index descriptors', () => {
    const expected = [1, 2, 3, 4];
    const input = [1, 2, 3, 4];
    Object.defineProperty(expected, '3', { writable: false });
    Object.defineProperty(input, '3', { writable: false });
    const state = new State(input);
    expect(() => expected.reverse()).toThrow(TypeError);
    expect(() => state.rows.reverse()).toThrow(TypeError);
    expect(shape(state.rows)).toEqual(shape(expected));
  });

  it('handles sealing/freezing/prototype changes after obtaining the method reference', () => {
    for (const freeze of [Object.seal, Object.freeze]) {
      const input = [1, 2, 3];
      const state = new State(input);
      const reverse = state.rows.reverse;
      freeze(state.rows);
      if (freeze === Object.freeze) expect(() => reverse.call(state.rows)).toThrow(TypeError);
      else {
        reverse.call(state.rows);
        expect([...state.rows]).toEqual([3, 2, 1]);
      }
    }
  });

  it('matches native reversal over mixed descriptors, holes and lengths', () => {
    for (let length = 0; length < 14; length++)
      for (let variant = 0; variant < 6; variant++) {
        const expected = Array.from({ length }, (_, index) =>
          index % 3 === 0 ? Number.NaN : index % 3 === 1 ? -0 : index,
        );
        for (let i = 0; i < length; i++) if ((i + variant) % 5 === 0) delete expected[i];
        const input = expected.slice();
        if (variant === 1 && length) {
          Object.defineProperty(expected, '0', { enumerable: false });
          Object.defineProperty(input, '0', { enumerable: false });
        }
        if (variant === 2 && length) {
          Object.defineProperty(expected, String(length - 1), { writable: false });
          Object.defineProperty(input, String(length - 1), { writable: false });
        }
        const state = new State(input);
        let failedExpected = false,
          failedActual = false;
        try {
          expected.reverse();
        } catch {
          failedExpected = true;
        }
        try {
          state.rows.reverse();
        } catch {
          failedActual = true;
        }
        expect(failedActual).toBe(failedExpected);
        expect(shape(state.rows)).toEqual(shape(expected));
      }
  });
});
