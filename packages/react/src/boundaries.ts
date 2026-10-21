import { isReactive, Service } from '@kinstate/core';
import { isValidElement } from 'react';
import { isReactiveComponent } from './component-tracking.js';
import {
  getCallbackCertificate,
  assertDeferredCaptures,
  assertSnapshotCaptures,
} from './callback-boundaries.js';

export type BoundaryKind = 'value' | 'command' | 'ref';

function assertRef(value: unknown): void {
  if (value == null || typeof value === 'function') return;
  if (typeof value === 'object' && !isReactive(value)) {
    const prototype = Object.getPrototypeOf(value);
    const current = Object.getOwnPropertyDescriptor(value, 'current');
    if ((prototype === null || prototype === Object.prototype) && current && 'value' in current)
      return;
  }
  throw new TypeError(
    'A reactive ref prop must be a callback, a plain React ref object, null, or undefined.',
  );
}

/**
 * Uninstrumented children receive evaluated values, never a live observable object.
 * Validation preserves identity and never invokes getters or clones a state tree.
 * React refs are imperative resources, not render dependencies.
 */
export function assertComponentBoundary(
  value: unknown,
  kind: BoundaryKind,
  receiver?: unknown,
): void {
  if (kind === 'value' && isReactiveComponent(receiver)) {
    assertDeferredCaptures(value);
    return;
  }
  if (kind === 'ref') return assertRef(value);
  if (kind === 'command') {
    if (value == null || typeof value === 'function') return;
    throw new TypeError('A reactive command prop must be a function, null, or undefined.');
  }
  const visited = new WeakSet<object>();
  const visit = (current: unknown): void => {
    if (typeof current === 'function') {
      // Service constructors are inert dependency-registration tokens, not deferred render callbacks.
      const prototype = Object.getOwnPropertyDescriptor(current, 'prototype');
      if (
        prototype &&
        'value' in prototype &&
        prototype.value &&
        (prototype.value === Service.prototype ||
          Object.prototype.isPrototypeOf.call(Service.prototype, prototype.value))
      )
        return;
      if (visited.has(current)) return;
      const captures = getCallbackCertificate(current);
      if (captures) {
        if (captures.blocked)
          throw new TypeError(
            'Reactive render callbacks must be synchronous; asynchronous work belongs in service methods or command callbacks.',
          );
        visited.add(current);
        assertSnapshotCaptures(captures.read());
        for (const field of Object.values(Object.getOwnPropertyDescriptors(current))) {
          if (!('value' in field))
            throw new TypeError(
              'Reactive callback properties must use data properties, not getters.',
            );
          visit(field.value);
        }
        return;
      }
      throw new TypeError(
        'Reactive render callbacks cannot cross component boundaries without safe snapshot captures. Capture evaluated primitive values for formatters, use an on* command prop for live events, or resolve useService in the rendering component.',
      );
    }
    if (current === null || typeof current !== 'object') return;
    if (isReactive(current)) {
      throw new TypeError(
        'Reactive objects cannot cross component boundaries. Read primitive values, derive plain data during rendering, or resolve useService in the receiving component.',
      );
    }
    if (visited.has(current)) return;
    visited.add(current);
    const fields = Object.getOwnPropertyDescriptors(current);
    const prototype = Object.getPrototypeOf(current);
    if (
      prototype !== null &&
      ![
        Object.prototype,
        Array.prototype,
        Date.prototype,
        RegExp.prototype,
        Map.prototype,
        Set.prototype,
      ].includes(prototype)
    ) {
      throw new TypeError(
        'Reactive component values must be plain data, arrays, supported native values, or React elements. Custom prototypes can hide untracked reads.',
      );
    }
    // Branding access must be safe before using React's public predicate. Valid
    // React19 dev elements may themselves contain a React-owned ref getter.
    const branding = fields.$$typeof;
    if (branding && !('value' in branding))
      throw new TypeError('Reactive component values must use data properties, not getters.');
    if (branding && isValidElement(current)) {
      const type = fields.type;
      if (type && 'value' in type && isReactiveComponent(type.value)) return;
      const props = fields.props;
      if (!props || !('value' in props) || props.value === null || typeof props.value !== 'object')
        throw new TypeError('React element props must be a plain data object.');
      const propsPrototype = Object.getPrototypeOf(props.value);
      if (propsPrototype !== null && propsPrototype !== Object.prototype)
        throw new TypeError('React element props cannot use custom prototypes.');
      const propFields = Object.getOwnPropertyDescriptors(props.value);
      for (const key of Reflect.ownKeys(propFields)) {
        if (key === 'key') continue; // React's reserved development warning accessor.
        const field = Reflect.get(propFields, key) as PropertyDescriptor;
        // React18 installs a reserved ref warning accessor on props; it is not passed as render data.
        if (key === 'ref' && !('value' in field)) continue;
        if (!('value' in field))
          throw new TypeError('Reactive component values must use data properties, not getters.');
        if (key === 'ref') {
          assertRef(field.value);
          continue;
        }
        if (
          typeof key === 'string' &&
          /^on[A-Z]/.test(key) &&
          (field.value == null || typeof field.value === 'function')
        )
          continue;
        visit(field.value);
      }
      return;
    }
    for (const key of Reflect.ownKeys(fields)) {
      const field = Reflect.get(fields, key) as PropertyDescriptor;
      if (!('value' in field))
        throw new TypeError('Reactive component values must use data properties, not getters.');
    }
    if (current instanceof Map) {
      for (const [key, entry] of Map.prototype.entries.call(current)) {
        visit(key);
        visit(entry);
      }
    } else if (current instanceof Set) {
      for (const entry of Set.prototype.values.call(current)) visit(entry);
    }
    for (const key of Reflect.ownKeys(fields))
      visit((Reflect.get(fields, key) as PropertyDescriptor).value);
  };
  visit(value);
}
