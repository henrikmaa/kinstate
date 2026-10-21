import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Service, ServiceScope } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

class Counter extends Service {
  count = 0;
  name = 'Counter';
  alternate = false;
  increment() {
    this.count++;
  }
}

describe('Phase 1: authored useService API', () => {
  it('updates only consumers of the changed property', async () => {
    const scope = new ServiceScope([Counter]);
    const counter = scope.get(Counter);
    const renders = { count: 0, name: 0 };
    function CountDisplay() {
      const service = useService(Counter);
      renders.count++;
      return <span data-testid="count">{service.count}</span>;
    }
    function NameDisplay() {
      const service = useService(Counter);
      renders.name++;
      return <span data-testid="name">{service.name}</span>;
    }
    render(
      <ServiceProvider services={[Counter]} scope={scope}>
        <CountDisplay />
        <NameDisplay />
      </ServiceProvider>,
    );
    const baseline = { ...renders };
    await act(async () => {
      counter.increment();
    });
    expect(screen.getByTestId('count').textContent).toBe('1');
    expect(renders.count - baseline.count).toBe(1);
    expect(renders.name).toBe(baseline.name);
    const next = { ...renders };
    await act(async () => {
      counter.name = 'Changed';
    });
    expect(screen.getByTestId('name').textContent).toBe('Changed');
    expect(renders.count).toBe(next.count);
    expect(renders.name - next.name).toBe(1);
    scope.dispose();
  });

  it('replaces conditional dependencies after each committed render', async () => {
    const scope = new ServiceScope([Counter]);
    const counter = scope.get(Counter);
    let renders = 0;
    function Display() {
      const service = useService(Counter);
      renders++;
      return <span data-testid="value">{service.alternate ? service.name : service.count}</span>;
    }
    render(
      <ServiceProvider services={[Counter]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    await act(async () => {
      counter.alternate = true;
    });
    const baseline = renders;
    await act(async () => {
      counter.count++;
    });
    expect(renders).toBe(baseline);
    await act(async () => {
      counter.name = 'Active';
    });
    expect(screen.getByTestId('value').textContent).toBe('Active');
    expect(renders - baseline).toBe(1);
    scope.dispose();
  });
});

it('returns the same consumer view across hooks and rerenders', async () => {
  const scope = new ServiceScope([Counter]);
  const counter = scope.get(Counter);
  function Display() {
    const first = useService(Counter);
    const second = useService(Counter);
    return (
      <span>
        {first === second ? 'same' : 'different'}:{first.count}
      </span>
    );
  }
  render(
    <ServiceProvider services={[Counter]} scope={scope}>
      <Display />
    </ServiceProvider>,
  );
  expect(screen.getByText('same:0')).toBeTruthy();
  await act(async () => {
    counter.increment();
  });
  expect(screen.getByText('same:1')).toBeTruthy();
  scope.dispose();
});
