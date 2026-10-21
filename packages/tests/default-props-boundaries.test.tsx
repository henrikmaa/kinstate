import React from 'react';
import { expect, it } from 'vitest';
import { Service, ServiceScope } from '@kinstate/core';
import { assertComponentBoundary } from '../react/src/boundaries.js';
import { certifyBoundaryCallback } from '../react/src/callback-boundaries.js';

type Props = { forwardRef?: () => unknown; forwardedRef?: () => unknown; config?: unknown };

function vendor(defaultProps: Props = {}) {
  return class Vendor extends React.Component<Props> {
    static defaultProps = defaultProps;
    render() {
      return null;
    }
  };
}

it.each(['forwardRef', 'forwardedRef'] as const)(
  'allows React-inserted %s callback defaults',
  (key) => {
    const noop = function () {};
    const Vendor = vendor({ [key]: noop });
    const element = React.createElement(Vendor);
    expect(element.props[key]).toBe(noop);
    expect(() => assertComponentBoundary(element, 'value')).not.toThrow();
  },
);

it('allows an explicitly supplied identical default function', () => {
  const noop = () => {};
  const Vendor = vendor({ forwardRef: noop });
  expect(() =>
    assertComponentBoundary(React.createElement(Vendor, { forwardRef: noop }), 'value'),
  ).not.toThrow();
});

it('continues rejecting authored function overrides', () => {
  const Vendor = vendor({ forwardRef: () => {} });
  expect(() =>
    assertComponentBoundary(React.createElement(Vendor, { forwardRef: () => {} }), 'value'),
  ).toThrow(/snapshot captures/);
});

it('does not trust arbitrary nested default objects', () => {
  const Vendor = vendor({ config: { formatter: () => 'label' } });
  expect(() => assertComponentBoundary(React.createElement(Vendor), 'value')).toThrow(
    /snapshot captures/,
  );
});

it('validates certified default callbacks and rejects live captures', () => {
  const noop = () => {};
  certifyBoundaryCallback(noop, () => [{ name: 'live' }]);
  const Vendor = vendor({ forwardRef: noop });
  expect(() => assertComponentBoundary(React.createElement(Vendor), 'value')).toThrow(/primitive/);
});

it('does not invoke a defaultProps getter to establish provenance', () => {
  const noop = () => {};
  const Vendor = vendor();
  const element = React.createElement(Vendor, { forwardRef: noop });
  let reads = 0;
  Object.defineProperty(Vendor, 'defaultProps', {
    get() {
      reads++;
      return { forwardRef: noop };
    },
  });
  expect(() => assertComponentBoundary(element, 'value')).toThrow(/snapshot captures/);
  expect(reads).toBe(0);
});

it('does not invoke default prop getters or trust inherited defaults', () => {
  const noop = () => {};
  const Vendor = vendor();
  const element = React.createElement(Vendor, { forwardRef: noop });
  let reads = 0;
  Object.defineProperty(Vendor.defaultProps, 'forwardRef', {
    get() {
      reads++;
      return noop;
    },
  });
  expect(() => assertComponentBoundary(element, 'value')).toThrow(/snapshot captures/);
  expect(reads).toBe(0);
  const Base = vendor({ forwardRef: noop });
  class Child extends Base {}
  expect(() => assertComponentBoundary(React.createElement(Child), 'value')).toThrow(
    /snapshot captures/,
  );
});

it('validates callback metadata and does not authorize unrelated prop names', () => {
  class State extends Service {
    user = { name: 'Ada' };
  }
  const scope = new ServiceScope([State]);
  try {
    const noop = () => {};
    Object.assign(noop, { user: scope.get(State).user });
    const Vendor = vendor({ forwardRef: noop });
    expect(() => assertComponentBoundary(React.createElement(Vendor), 'value')).toThrow(
      /Reactive objects/,
    );
    const clean = () => {};
    const Other = vendor({ forwardRef: clean });
    expect(() =>
      assertComponentBoundary(React.createElement(Other, { forwardedRef: clean }), 'value'),
    ).toThrow(/snapshot captures/);
  } finally {
    scope.dispose();
  }
});
