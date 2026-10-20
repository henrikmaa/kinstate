import React, { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { collectDependencies, flushSync, observe, Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

// The longer runner uses the same compiled React path as the regular acceptance suite.
const cycles = process.env.REACT_SERVICE_LOAD_LONG === '1' ? 1000 : 50;
const active = new Set<LoadService>();
let initialized = 0;
let disposed = 0;
let effects = 0;
let renders = 0;
class LoadService extends Service {
  alternate = false;
  left = 0;
  right = 0;
  unrelated = 0;
  private stop: (() => void) | undefined;
  onInit() {
    initialized++;
    active.add(this);
    this.stop = observe(() => {
      void (this.alternate ? this.right : this.left);
      effects++;
    });
  }
  onDispose() {
    disposed++;
    this.stop?.();
    this.stop = undefined;
    active.delete(this);
  }
}
function Consumer() {
  const state = useService(LoadService);
  renders++;
  return <span>{state.alternate ? state.right : state.left}</span>;
}
function subscriptions(service: LoadService) {
  // A structural inspection verifies actual atom cleanup without retaining subscriptions itself.
  return [
    ...collectDependencies(() => [
      service.alternate,
      service.left,
      service.right,
    ]).dependencies.keys(),
  ].map((dependency) => dependency as typeof dependency & { watchers: Set<() => void> });
}
const update = async (mutation: () => void) => {
  await act(async () => {
    mutation();
    flushSync();
  });
};
afterEach(() => {
  cleanup();
  expect(active.size).toBe(0);
});

it('sustains Strict Mode mount/update/unmount churn with independent scopes and no retained observers', async () => {
  for (let cycle = 0; cycle < cycles; cycle++) {
    const view = render(
      <StrictMode>
        <ServiceProvider services={[LoadService]}>
          <Consumer />
          <ServiceProvider services={[LoadService]}>
            <Consumer />
          </ServiceProvider>
        </ServiceProvider>
      </StrictMode>,
    );
    expect(active.size).toBe(2);
    const [first, second] = [...active];
    expect(first).not.toBe(second);
    const nodes = [...subscriptions(first!), ...subscriptions(second!)];
    await update(() => {
      first!.left = cycle + 1;
    });
    expect(view.container.textContent).toBe(`${cycle + 1}0`);
    const prior = renders;
    const priorEffects = effects;
    await update(() => {
      first!.unrelated++;
      second!.unrelated++;
    });
    expect(renders).toBe(prior);
    expect(effects).toBe(priorEffects);
    await update(() => {
      first!.alternate = true;
    });
    const switched = renders;
    const switchedEffects = effects;
    await update(() => {
      first!.left++;
    });
    expect(renders).toBe(switched);
    expect(effects).toBe(switchedEffects);
    await update(() => {
      first!.right = cycle + 2;
    });
    expect(view.container.textContent).toBe(`${cycle + 2}0`);
    await act(async () => {
      view.unmount();
    });
    expect(active.size).toBe(0);
    expect(nodes.every((node) => node.watchers.size === 0)).toBe(true);
    const finalRenders = renders;
    const finalEffects = effects;
    await update(() => {
      first!.right++;
      second!.left++;
    });
    expect(renders).toBe(finalRenders);
    expect(effects).toBe(finalEffects);
  }
  expect(initialized).toBe(cycles * 2);
  expect(disposed).toBe(initialized);
}, 120_000);
