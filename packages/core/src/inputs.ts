import type { Service, ServiceConstructor, ValidInjection } from './service.js';

/** External input descriptors own only shallow snapshots; nested values stay borrowed. */
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;
type InputKeys<T> = {
  [K in keyof T]-?: K extends keyof Service
    ? never
    : K extends string
      ? Equal<Pick<T, K>, { -readonly [P in keyof Pick<T, K>]: Pick<T, K>[P] }> extends true
        ? K
        : never
      : never;
}[keyof T];
/** Public writable state fields that can receive externally owned state. */
export type ServiceInputs<T extends Service> = Partial<Pick<T, InputKeys<T>>>;
type InvalidInputs<T extends Service, V> = {
  [K in keyof V]-?: K extends InputKeys<T> ? (V[K] extends T[K] ? never : K) : K;
}[keyof V];
const inputBrand: unique symbol = Symbol('ServiceInputBinding');
/** An immutable, shallow input snapshot produced by serviceInputs(). */
export interface ServiceInputBinding {
  readonly [inputBrand]: true;
  readonly service: ServiceConstructor;
  readonly values: Readonly<Record<string, unknown>>;
}
const inputBindings = new WeakSet<object>();
const unsafeInputKeys = new Set(['__proto__', 'constructor', 'prototype', 'onInit', 'onDispose']);
/** Bind ordinary external state to declared service fields, without copying nested data. */
export function serviceInputs<C extends ServiceConstructor, V extends object>(
  service: C & ValidInjection<C>,
  values: V & ServiceInputs<InstanceType<NoInfer<C>>>,
  ..._invalid: [InvalidInputs<InstanceType<NoInfer<C>>, NoInfer<V>>] extends [never]
    ? []
    : [invalid: never]
): ServiceInputBinding {
  if (!values || typeof values !== 'object')
    throw new Error('Service inputs must be a state object');
  const snapshot: Record<string, unknown> = Object.create(null);
  for (const key of Reflect.ownKeys(values)) {
    if (typeof key !== 'string' || unsafeInputKeys.has(key))
      throw new Error(`Invalid service input property: ${String(key)}`);
    const field = Object.getOwnPropertyDescriptor(values, key)!;
    if (!('value' in field)) throw new Error(`Service input must be a data value: ${key}`);
    snapshot[key] = field.value;
  }
  const binding: ServiceInputBinding = Object.freeze({
    [inputBrand]: true as const,
    service,
    values: Object.freeze(snapshot),
  });
  inputBindings.add(binding);
  return binding;
}
export function validateInputBindings(bindings: readonly ServiceInputBinding[]): void {
  const seen = new Set<ServiceConstructor>();
  for (const binding of bindings) {
    if (!binding || !inputBindings.has(binding))
      throw new Error('Use serviceInputs() to create service input bindings');
    if (seen.has(binding.service))
      throw new Error(`Duplicate service input binding: ${binding.service.name}`);
    seen.add(binding.service);
  }
}
export function validateInputFields(
  instance: Service,
  values: Readonly<Record<string, unknown>>,
): void {
  for (const key of Object.keys(values)) {
    const field = Object.getOwnPropertyDescriptor(instance, key);
    if (unsafeInputKeys.has(key) || !field || !('value' in field) || !field.writable) {
      throw new Error(`Service input must target an own writable data property: ${key}`);
    }
  }
}
