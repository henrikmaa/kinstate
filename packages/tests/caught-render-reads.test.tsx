import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { flushSync, Service, ServiceScope } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import { RenderFrame } from '../react/src/render-frame.js';

const scopes: ServiceScope[] = [];
afterEach(async () => {
  await act(async () => cleanup());
  for (const scope of scopes.splice(0)) scope.dispose();
});

it('recovers a locally caught getter failure and keeps unrelated consumers selective', async () => {
  const unavailable = new Error('Not ready');
  class State extends Service {
    ready = false;
    value = 2;
    name = 'unchanged';
    get result() {
      if (!this.ready) throw unavailable;
      return this.value * 2;
    }
  }
  const scope = new ServiceScope([State]);
  scopes.push(scope);
  const state = scope.get(State);
  let resultRenders = 0;
  let nameRenders = 0;
  function Result() {
    const service = useService(State);
    resultRenders++;
    try {
      return <span data-testid="result">{service.result}</span>;
    } catch (error) {
      expect(error).toBe(unavailable);
      return <span data-testid="result">Waiting</span>;
    }
  }
  function Name() {
    const service = useService(State);
    nameRenders++;
    return <span>{service.name}</span>;
  }
  const view = render(
    <ServiceProvider services={[State]} scope={scope}>
      <Result />
      <Name />
    </ServiceProvider>,
  );
  expect(view.getByTestId('result').textContent).toBe('Waiting');
  await act(async () => {
    state.value = 3;
    flushSync();
  });
  expect(resultRenders).toBe(1);
  await act(async () => {
    state.ready = true;
    flushSync();
  });
  expect(view.getByTestId('result').textContent).toBe('6');
  expect(resultRenders).toBe(2);
  expect(nameRenders).toBe(1);
  await act(async () => {
    state.value = 4;
    flushSync();
  });
  expect(view.getByTestId('result').textContent).toBe('8');
  expect(resultRenders).toBe(3);
  expect(nameRenders).toBe(1);
});

it('retains method dependencies when the rendered fallback catches a falsy thrown value', async () => {
  class State extends Service {
    ready = false;
    read() {
      if (!this.ready) throw undefined;
      return 'ready';
    }
  }
  const scope = new ServiceScope([State]);
  scopes.push(scope);
  const state = scope.get(State);
  let renders = 0;
  function Result() {
    const service = useService(State);
    renders++;
    try {
      return <span>{service.read()}</span>;
    } catch {
      return <span>Waiting</span>;
    }
  }
  const view = render(
    <ServiceProvider services={[State]} scope={scope}>
      <Result />
    </ServiceProvider>,
  );
  expect(view.container.textContent).toBe('Waiting');
  await act(async () => {
    state.ready = true;
    flushSync();
  });
  expect(view.container.textContent).toBe('ready');
  expect(renders).toBe(2);
});

it('validates mutations between a caught read and subscription without retaining failed renders globally', () => {
  class State extends Service {
    value = 0;
  }
  const service = new State();
  const frame = new RenderFrame();
  const failure = new Error('read failed');
  expect(() =>
    frame.track(() => {
      void service.value;
      throw failure;
    }),
  ).toThrow(failure);
  frame.finish(null);
  const initial = frame.getSnapshot();
  service.value = 1;
  expect(frame.getSnapshot()).not.toBe(initial);
  let notifications = 0;
  const stop = frame.subscribe(() => notifications++);
  service.value = 2;
  flushSync();
  expect(notifications).toBe(1);
  stop();
  service.value = 3;
  flushSync();
  expect(notifications).toBe(1);
});
