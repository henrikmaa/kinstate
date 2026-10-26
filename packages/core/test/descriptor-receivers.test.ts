import { describe, expect, it, vi } from 'vitest';
import {
  Service,
  ServiceScope,
  serviceInputs,
  observe,
  collectDependencies,
  flushSync,
} from '../src/index.js';

class Counter extends Service {
  count = 1;
  get doubled() {
    return this.count * 2;
  }
  increment() {
    this.count++;
  }
  command = () => {
    this.count++;
  };
}

describe('canonical getters and method receivers', () => {
  it('copies foreign proxy descriptors without retaining its get trap and preserves accessor receivers', () => {
    const receivers: unknown[] = [];
    const foreign = new Proxy(
      {
        value: 3,
        get doubled() {
          receivers.push(this);
          return this.value * 2;
        },
      },
      {
        get(target, key, receiver) {
          if (key === 'value') receivers.push(receiver);
          return Reflect.get(target, key, receiver);
        },
      },
    );
    class State extends Service {
      row = foreign;
      rows = [foreign];
    }
    const source = new State();
    const row = source.row;
    expect(row.value).toBe(3);
    expect(row.value).toBe(3);
    expect(source.rows.map((item) => item.value)).toEqual([3]);
    expect(receivers).toHaveLength(0);
    expect(row.doubled).toBe(6);
    expect(row.doubled).toBe(6);
    expect(receivers).toHaveLength(1);
    expect(receivers.every((receiver) => receiver === row)).toBe(true);
  });

  it('keeps borrowed getter evaluations separate regardless of read order', () => {
    const first = new Counter();
    expect(Reflect.get(first, 'doubled', { count: 8 })).toBe(16);
    expect(first.doubled).toBe(2);
    const second = new Counter();
    expect(second.doubled).toBe(2);
    expect(Reflect.get(second, 'doubled', { count: 8 })).toBe(16);
    second.count = 3;
    expect(second.doubled).toBe(6);
  });

  it('collects borrowed receiver fields in the outer observation without retaining a receiver cache', () => {
    const source = new Counter();
    const receiver = new Counter();
    const values: number[] = [];
    const stop = observe(() => values.push(Reflect.get(source, 'doubled', receiver)));
    source.count = 5;
    flushSync();
    expect(values).toEqual([2]);
    receiver.count = 3;
    flushSync();
    expect(values).toEqual([2, 6]);
    expect(source.doubled).toBe(10);
    Object.defineProperty(source, 'doubled', {
      configurable: true,
      get(this: Counter) {
        return this.count * 3;
      },
    });
    flushSync();
    expect(values).toEqual([2, 6, 9]);
    expect(source.doubled).toBe(15);
    Object.defineProperty(source, 'doubled', { configurable: true, get: () => 42 });
    flushSync();
    receiver.count = 4;
    flushSync();
    expect(values).toEqual([2, 6, 9, 42]);
    Reflect.deleteProperty(source, 'doubled');
    flushSync();
    expect(values).toEqual([2, 6, 9, 42, 8]);
    stop();
    flushSync();
  });

  it('preserves inherited getter receivers on objects inheriting a reactive proxy', () => {
    const source = new Counter();
    const child = Object.create(source) as Counter;
    Object.defineProperty(child, 'count', { value: 7, writable: true });
    expect(child.doubled).toBe(14);
    expect(source.doubled).toBe(2);
    child.count = 8;
    expect(child.doubled).toBe(16);
    expect(source.doubled).toBe(2);
  });

  it('binds service commands to their canonical service even when first read with another receiver', () => {
    const source = new Counter();
    const receiver = { count: 10 };
    const command = Reflect.get(source, 'increment', receiver);
    expect(command).toBe(source.increment);
    command();
    expect(source.count).toBe(2);
    expect(receiver.count).toBe(10);
    const detached = source.increment;
    detached.call(receiver);
    expect(source.count).toBe(3);
    expect(receiver.count).toBe(10);
  });
});

describe('pinning observable data descriptors', () => {
  it('preserves captured canonical identity when pinning an owned data slot', () => {
    const raw = { value: 1 };
    class State extends Service {
      child = raw;
    }
    const source = new State();
    const captured = collectDependencies(() => source.child);
    const values: object[] = [];
    const stop = observe(() => values.push(source.child));
    Object.defineProperty(source, 'child', { configurable: false, writable: false });
    expect(source.child).toBe(captured.value);
    expect(Object.getOwnPropertyDescriptor(source, 'child')!.value).toBe(source.child);
    expect([...captured.dependencies].some(([dep, version]) => dep.getVersion() !== version)).toBe(
      false,
    );
    flushSync();
    expect(values).toHaveLength(1);
    expect(values[0]).not.toBe(raw);
    stop();
    flushSync();
  });

  it('preserves native array iteration identities when freezing canonical object indices', () => {
    const raw = { value: 1 };
    class State extends Service {
      rows = [raw];
    }
    const source = new State();
    const values: object[][] = [];
    const stop = observe(() => values.push(source.rows.map((row) => row)));
    Object.freeze(source.rows);
    flushSync();
    expect(values).toHaveLength(1);
    expect(values[0]![0]).not.toBe(raw);
    expect(values[0]![0]).toBe(source.rows[0]);
    expect(Object.isFrozen(source.rows)).toBe(true);
    stop();
    flushSync();
  });

  it('keeps Object.is equality for primitive fields and already opaque immutable inputs', () => {
    const source = new Counter();
    const counter = vi.fn(() => source.count);
    const stopCounter = observe(counter);
    Object.defineProperty(source, 'count', { configurable: false, writable: false });
    flushSync();
    expect(counter).toHaveBeenCalledTimes(1);
    class Input extends Service {
      child = { value: 0 };
    }
    const raw = { value: 2 };
    const scope = new ServiceScope([Input], { inputs: [serviceInputs(Input, { child: raw })] });
    const input = scope.get(Input);
    const canonical = input.child;
    const read = vi.fn(() => input.child);
    const stop = observe(read);
    Object.defineProperty(input, 'child', { configurable: false, writable: false });
    flushSync();
    expect(read).toHaveBeenCalledTimes(1);
    expect(input.child).toBe(canonical);
    expect(input.child).not.toBe(raw);
    stopCounter();
    stop();
    scope.dispose();
    flushSync();
  });

  it('notifies function references when pinning disables canonical method wrapping', () => {
    const source = new Counter();
    const commands: Function[] = [];
    const stop = observe(() => commands.push(source.command));
    Object.defineProperty(source, 'command', { configurable: false, writable: false });
    flushSync();
    expect(commands).toHaveLength(2);
    expect(commands[0]).not.toBe(commands[1]);
    commands[1]!();
    expect(source.count).toBe(2);
    stop();
    flushSync();
  });

  it('notifies cached array method references when pinning requires the native function identity', () => {
    class State extends Service {
      rows = [1, 2];
    }
    const source = new State();
    Object.defineProperty(source.rows, 'map', {
      configurable: true,
      writable: true,
      value: Array.prototype.map,
    });
    const methods: Function[] = [];
    const stop = observe(() => methods.push(source.rows.map));
    expect(methods[0]).not.toBe(Array.prototype.map);
    expect(methods[0]).toBe(source.rows.map);
    Object.defineProperty(source.rows, 'map', { configurable: false, writable: false });
    flushSync();
    expect(methods).toHaveLength(2);
    expect(methods[1]).toBe(Array.prototype.map);
    expect(source.rows.map((value) => value * 2)).toEqual([2, 4]);
    stop();
    flushSync();
  });
});
