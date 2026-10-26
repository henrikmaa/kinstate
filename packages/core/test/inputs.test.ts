import { describe, expect, it, vi } from 'vitest';
import {
  Service,
  ServiceScope,
  dependencies,
  flushSync,
  observe,
  serviceInputs,
} from '../src/index.js';

class Data extends Service {
  value = 0;
  label = '';
  payload: { readonly id: number } | undefined = undefined;
  get doubled() {
    return this.value * 2;
  }
  method() {}
}

describe('external service inputs', () => {
  it('applies initial inputs after hydration and before dependent construction or init', () => {
    const seen: number[] = [];
    class Dependent extends Service {
      static inject = dependencies(Data);
      constructor(readonly data: Data) {
        super();
        seen.push(data.value);
      }
      onInit() {
        seen.push(this.data.value);
      }
    }
    const scope = new ServiceScope([Data, Dependent], {
      initialState: [{ service: Data, state: { value: 1 } }],
      inputs: [serviceInputs(Data, { value: 2 })],
    });
    scope.get(Dependent);
    scope.start();
    expect(seen).toEqual([2, 2]);
    scope.dispose();
  });
  it('updates a stable instance, batches derived changes and retains omitted fields', () => {
    const scope = new ServiceScope([Data]);
    const data = scope.get(Data);
    const effect = vi.fn(() => [data.doubled, data.label]);
    const stop = observe(effect);
    expect(scope.applyInputs([serviceInputs(Data, { value: 2, label: 'ready' })])).toBe(true);
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    expect(scope.get(Data)).toBe(data);
    expect(scope.applyInputs([serviceInputs(Data, { value: 2 })])).toBe(false);
    flushSync();
    expect(effect).toHaveBeenCalledTimes(2);
    expect(data.label).toBe('ready');
    expect(scope.applyInputs([])).toBe(false);
    expect(data.value).toBe(2);
    data.value = 3;
    expect(scope.applyInputs([serviceInputs(Data, { value: 2 })])).toBe(false);
    expect(data.value).toBe(3);
    scope.applyInputs([serviceInputs(Data, { value: 4 })]);
    expect(data.value).toBe(4);
    stop();
    scope.dispose();
  });
  it('takes a binding snapshot and copies frozen input data without changing descriptors', () => {
    const payload = Object.freeze({ id: 5 });
    const values = { value: 4, payload };
    const binding = serviceInputs(Data, values);
    values.value = 9;
    expect(Object.isFrozen(binding)).toBe(true);
    expect(Object.isFrozen(binding.values)).toBe(true);
    const scope = new ServiceScope([Data], { inputs: [binding] });
    const data = scope.get(Data);
    expect(data.value).toBe(4);
    expect(data.payload).not.toBe(payload);
    expect(data.payload).toEqual(payload);
    expect(Object.isFrozen(data.payload)).toBe(true);
    scope.dispose();
  });
  it('rejects duplicate bindings and invalid fields atomically without invoking accessors', () => {
    const scope = new ServiceScope([Data]);
    const data = scope.get(Data);
    const duplicate = [serviceInputs(Data, { value: 1 }), serviceInputs(Data, { label: 'x' })];
    expect(() => scope.applyInputs(duplicate)).toThrow(/Duplicate/);
    expect(data.value).toBe(0);
    const getter = vi.fn();
    expect(() => serviceInputs(Data, Object.defineProperty({}, 'value', { get: getter }))).toThrow(
      /data value/,
    );
    expect(getter).not.toHaveBeenCalled();
    for (const key of ['unknown', 'doubled', 'method']) {
      const values = { value: 5, [key]: 9 };
      expect(() => scope.applyInputs([serviceInputs(Data, values as never)])).toThrow(
        /writable data property/,
      );
      expect(data.value).toBe(0);
    }
    Object.defineProperty(data, 'label', { writable: false });
    expect(() => scope.applyInputs([serviceInputs(Data, { value: 5, label: 'x' })])).toThrow(
      /writable/,
    );
    expect(data.value).toBe(0);
    scope.dispose();
  });
  it('rejects dangerous keys, forged bindings and ancestor writes', () => {
    const parent = new ServiceScope([Data]);
    const child = new ServiceScope([], { parent });
    expect(() => serviceInputs(Data, JSON.parse('{"__proto__":1}') as never)).toThrow(/Invalid/);
    expect(
      () => new ServiceScope([Data], { inputs: [{ service: Data, values: {} } as never] }),
    ).toThrow(/serviceInputs/);
    expect(() => child.applyInputs([serviceInputs(Data, { value: 5 })])).toThrow(/local ownership/);
    expect(
      () => new ServiceScope([], { parent, inputs: [serviceInputs(Data, { value: 5 })] }),
    ).toThrow(/local registration/);
    expect(parent.get(Data).value).toBe(0);
    child.dispose();
    parent.dispose();
  });
  it('does not initialize lazy input targets and updates local overrides only', () => {
    let initialized = 0;
    class Local extends Data {
      onInit() {
        initialized++;
      }
    }
    const parent = new ServiceScope([Local]);
    const child = new ServiceScope([Local], { parent });
    child.applyInputs([serviceInputs(Local, { value: 7 })]);
    expect(initialized).toBe(0);
    expect(child.get(Local).value).toBe(7);
    expect(parent.get(Local).value).toBe(0);
    child.start();
    expect(initialized).toBe(1);
    child.dispose();
    parent.dispose();
    expect(() => child.applyInputs([])).toThrow(/disposed/);
  });
  it('preserves callback identity, return values, receivers and normal method binding', async () => {
    class Callbacks extends Service {
      value = 1;
      onSave: ((name: string) => Promise<number>) | undefined = undefined;
      ownCallback = () => 3;
      increment() {
        this.value++;
      }
    }
    const scope = new ServiceScope([Callbacks]);
    const service = scope.get(Callbacks);
    const promise = Promise.resolve(8);
    const callback = vi.fn((_name: string) => promise);
    scope.applyInputs([serviceInputs(Callbacks, { onSave: callback })]);
    expect(service.onSave).toBe(callback);
    expect(service.onSave!('first')).toBe(promise);
    expect(await service.onSave!('second')).toBe(8);
    const detached = service.increment;
    detached();
    expect(service.value).toBe(2);
    const ownCallback: () => number = Object.getOwnPropertyDescriptor(
      service,
      'ownCallback',
    )!.value;
    expect(scope.applyInputs([serviceInputs(Callbacks, { ownCallback })])).toBe(true);
    expect(scope.applyInputs([serviceInputs(Callbacks, { ownCallback })])).toBe(false);
    expect(service.ownCallback).toBe(ownCallback);
    const receiverCallback = function (this: { value: number }) {
      return this.value;
    };
    scope.applyInputs([serviceInputs(Callbacks, { ownCallback: receiverCallback })]);
    expect(service.ownCallback()).toBe(2);
    expect(service.ownCallback.call({ value: 9 })).toBe(9);
    scope.dispose();
  });
  it('reacts to callback replacement and clearing without swallowing errors', async () => {
    class Callbacks extends Service {
      onSave: (() => Promise<void>) | undefined = undefined;
    }
    const scope = new ServiceScope([Callbacks]);
    const service = scope.get(Callbacks);
    const seen = vi.fn(() => service.onSave);
    const stop = observe(seen);
    const error = new Error('upstream');
    const callback = () => Promise.reject(error);
    expect(scope.applyInputs([serviceInputs(Callbacks, { onSave: callback })])).toBe(true);
    flushSync();
    expect(seen).toHaveBeenCalledTimes(2);
    await expect(service.onSave!()).rejects.toBe(error);
    const sync = () => {
      throw error;
    };
    scope.applyInputs([serviceInputs(Callbacks, { onSave: sync })]);
    expect(service.onSave).toBe(sync);
    expect(() => service.onSave!()).toThrow(error);
    scope.applyInputs([serviceInputs(Callbacks, { onSave: undefined })]);
    flushSync();
    expect(service.onSave).toBeUndefined();
    expect(seen).toHaveBeenCalledTimes(3);
    stop();
    scope.dispose();
  });
  it('rejects prototype callbacks and own lifecycle overrides before batch writes', () => {
    class Callbacks extends Data {
      onInit = () => {};
      onDispose = () => {};
    }
    const scope = new ServiceScope([Callbacks]);
    const service = scope.get(Callbacks);
    expect(() => scope.applyInputs([serviceInputs(Callbacks, { value: 8, method() {} })])).toThrow(
      /writable data property/,
    );
    expect(service.value).toBe(0);
    for (const name of ['onInit', 'onDispose']) {
      expect(() => serviceInputs(Callbacks, { value: 8, [name]: () => {} } as never)).toThrow(
        /Invalid service input/,
      );
      expect(service.value).toBe(0);
    }
    scope.dispose();
  });
  it('invalidates cached callback getters on an equal first binding', () => {
    class Callbacks extends Service {
      onSave = () => 1;
      get callback() {
        return this.onSave;
      }
    }
    const scope = new ServiceScope([Callbacks]);
    const service = scope.get(Callbacks);
    const original: () => number = Object.getOwnPropertyDescriptor(service, 'onSave')!.value;
    const before = service.callback;
    const seen = vi.fn(() => service.callback);
    const stop = observe(seen);
    expect(before).not.toBe(original);
    expect(scope.applyInputs([serviceInputs(Callbacks, { onSave: original })])).toBe(true);
    flushSync();
    expect(service.callback).toBe(original);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(scope.applyInputs([serviceInputs(Callbacks, { onSave: original })])).toBe(false);
    flushSync();
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    scope.dispose();
  });
});
