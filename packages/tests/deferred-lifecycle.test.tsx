import React, { Suspense } from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Service, dependencies } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

it('does not initialize deferred services from suspended renders or unrelated sibling commits', async () => {
  const events: string[] = [];
  class Dependency extends Service {
    onInit() {
      events.push('dependency init');
    }
    onDispose() {
      events.push('dependency dispose');
    }
  }
  class Resource extends Service {
    static inject = dependencies(Dependency);
    constructor(readonly dependency: Dependency) {
      super();
    }
    value = 'resource';
    onInit() {
      events.push('resource init');
    }
    onDispose() {
      events.push('resource dispose');
    }
  }
  class Other extends Service {
    value = 'other';
    onInit() {
      events.push('other init');
    }
    onDispose() {
      events.push('other dispose');
    }
  }
  const suspended = new Promise<void>(() => {});
  let shouldSuspend = true;
  function Consumer() {
    const service = useService(Resource);
    if (shouldSuspend) throw suspended;
    return <span>{service.value}</span>;
  }
  function Sibling() {
    const service = useService(Other);
    return <span>{service.value}</span>;
  }
  const tree = (consumer: boolean, sibling: boolean) => (
    <ServiceProvider services={[]}>
      <Suspense fallback={<span>waiting</span>}>{consumer ? <Consumer /> : null}</Suspense>
      {sibling ? <Sibling /> : null}
    </ServiceProvider>
  );
  const view = render(tree(false, false));
  view.rerender(tree(true, false));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('waiting')).toBeTruthy();
  expect(events).toEqual([]);
  view.rerender(tree(true, true));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('other')).toBeTruthy();
  expect(events).toEqual(['other init']);
  shouldSuspend = false;
  view.rerender(tree(true, true));
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByText('resource')).toBeTruthy();
  expect(events).toEqual(['other init', 'dependency init', 'resource init']);
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(events.filter((event) => event.endsWith('dispose')).sort()).toEqual([
    'dependency dispose',
    'other dispose',
    'resource dispose',
  ]);
});
