import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { Service, ServiceScope, flushSync } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
class State extends Service {
  count = 0;
  unrelated = 0;
  useCount() {
    return this.count;
  }
  nested = {
    count: 0,
    useCount() {
      return this.count;
    },
  };
}
afterEach(cleanup);
it('tracks ordinary service methods and method aliases beginning with use', async () => {
  const scope = new ServiceScope([State]);
  const state = scope.get(State);
  let direct = 0,
    alias = 0,
    destructured = 0;
  function Direct() {
    const service = useService(State);
    direct++;
    return <span data-testid="direct">{service.useCount()}</span>;
  }
  function Alias() {
    const service = useService(State);
    const read = service.useCount;
    const useCount = read;
    alias++;
    return <span data-testid="alias">{useCount()}</span>;
  }
  function Destructured() {
    const service = useService(State);
    const { useCount } = service;
    destructured++;
    return <span data-testid="destructured">{useCount()}</span>;
  }
  render(
    <ServiceProvider services={[State]} scope={scope}>
      <Direct />
      <Alias />
      <Destructured />
    </ServiceProvider>,
  );
  await act(async () => {
    state.count++;
    flushSync();
  });
  expect(screen.getByTestId('direct').textContent).toBe('1');
  expect(screen.getByTestId('alias').textContent).toBe('1');
  expect(screen.getByTestId('destructured').textContent).toBe('1');
  expect({ direct, alias, destructured }).toEqual({ direct: 2, alias: 2, destructured: 2 });
  await act(async () => {
    state.unrelated++;
    flushSync();
  });
  expect({ direct, alias, destructured }).toEqual({ direct: 2, alias: 2, destructured: 2 });
  scope.dispose();
});

it('tracks computed method keys named like hooks and alternating TypeScript member wrappers', async () => {
  const scope = new ServiceScope([State]);
  const state = scope.get(State);
  function Computed() {
    const service = useService(State);
    const useCount = 'useCount';
    return <span data-testid="computed">{service[useCount]()}</span>;
  }
  function Wrapped() {
    const service = useService(State);
    return (
      <span data-testid="wrapped">
        {(
          service.nested as { count: number; useCount(): number } satisfies { count: number }
        ).useCount()}
      </span>
    );
  }
  render(
    <ServiceProvider services={[State]} scope={scope}>
      <Computed />
      <Wrapped />
    </ServiceProvider>,
  );
  await act(async () => {
    state.count = 2;
    state.nested.count = 3;
    flushSync();
  });
  expect(screen.getByTestId('computed').textContent).toBe('2');
  expect(screen.getByTestId('wrapped').textContent).toBe('3');
  scope.dispose();
});
