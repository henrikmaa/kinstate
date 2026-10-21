import React, { StrictMode, useCallback, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { Service, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

it('reconciles real external-store publications and React callback state before settled UI, preserving local edits', async () => {
  const cache = createStore<{
    product: Readonly<{ name: string; revision: number }>;
    busy: boolean;
  }>(() => ({
    product: Object.freeze({ name: 'Book', revision: 0 }),
    busy: false,
  }));
  class Editor extends Service {
    product = cache.getState().product;
    publish: ((name: string) => void) | undefined = undefined;
    format: ((name: string) => string) | undefined = undefined;
    draft = 'Local draft';
    get caption() {
      return this.format?.(this.product.name) ?? this.product.name;
    }
    edit(value: string) {
      this.draft = value;
    }
    save() {
      this.publish?.(this.draft);
    }
  }
  let renders = 0;
  function View() {
    const service = useService(Editor);
    const revision = useStore(cache, (state) => state.product.revision);
    renders++;
    return (
      <>
        <output data-testid="cache-value">
          {revision}:{service.product.revision}:{service.caption}
        </output>
        <input
          aria-label="Draft"
          value={service.draft}
          onChange={(event) => {
            service.edit(event.target.value);
          }}
        />
        <button onClick={() => service.save()}>Save draft</button>
      </>
    );
  }
  const consumers = <View />;
  function Source() {
    const { product } = useStore(cache);
    const [prefix, setPrefix] = useState('Current');
    const format = useCallback((name: string) => `${prefix} ${name}`, [prefix]);
    const publish = useCallback(
      (name: string) => {
        cache.setState((state) => ({
          product: Object.freeze({
            name: `${prefix} ${name}`,
            revision: state.product.revision + 1,
          }),
        }));
      },
      [prefix],
    );
    return (
      <>
        <button onClick={() => setPrefix('Latest')}>Change callback</button>
        <ServiceProvider services={[serviceInputs(Editor, { product, format, publish })]}>
          {consumers}
        </ServiceProvider>
      </>
    );
  }
  const view = render(
    <StrictMode>
      <Source />
    </StrictMode>,
  );
  expect(screen.getByTestId('cache-value').textContent).toBe('0:0:Current Book');
  const initial = renders;
  await act(async () => {
    cache.setState({ busy: true });
  });
  expect(renders).toBe(initial);
  await act(async () => {
    for (let revision = 1; revision <= 100; revision++)
      cache.setState({ product: Object.freeze({ name: `Book ${revision}`, revision }) });
  });
  expect(screen.getByTestId('cache-value').textContent).toBe('100:100:Current Book 100');
  expect((screen.getByLabelText('Draft') as HTMLInputElement).value).toBe('Local draft');
  await act(async () => {
    fireEvent.click(screen.getByText('Change callback'));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'Edited' } });
  });
  await act(async () => {
    fireEvent.click(screen.getByText('Save draft'));
  });
  expect(cache.getState().product.name).toBe('Latest Edited');
  expect(screen.getByTestId('cache-value').textContent).toBe('101:101:Latest Latest Edited');
  view.unmount();
  // Source ownership remains outside the disposed service scope.
  cache.setState({ product: Object.freeze({ name: 'After unmount', revision: 102 }) });
  expect(cache.getState().product.revision).toBe(102);
});
