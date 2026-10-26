import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import type { Case, Library, Sample } from '../schema.js';
import { adapterFor } from './adapters.js';
import { initialState, mutatePlain, select } from './model.js';

// Keep the scheduler identical. An awaited turn lets default async stores
// deliver, then flushSync commits pending React work without flushing any
// library's private notification queue directly.
async function settle(): Promise<void> {
  await Promise.resolve();
  flushSync(() => {});
}

export async function runBenchmark(library: Library, test: Case): Promise<Sample> {
  if (!import.meta.env.PROD) throw new Error('Benchmarks require a production Vite build');
  if (
    !Number.isSafeInteger(test.size) ||
    test.size < 1 ||
    !Number.isSafeInteger(test.consumers) ||
    test.consumers < 1 ||
    test.consumers > (test.workload === 'full-list-row' ? test.size : Math.min(100, test.size)) ||
    !Number.isSafeInteger(test.operations) ||
    test.operations < 1
  )
    throw new Error('Invalid benchmark case');
  const setupStarted = performance.now();
  const adapter = adapterFor(library, test);
  const setupMs = performance.now() - setupStarted;
  const stats = { renders: 0 };
  const element = document.createElement('div');
  document.body.append(element);
  const root = createRoot(element);
  let rerender: (() => void) | undefined;
  function Parent() {
    const [tick, update] = useState(0);
    rerender = () => update((value) => value + 1);
    const children = Array.from({ length: test.consumers }, (_, index) => (
      <adapter.Consumer
        key={index}
        index={index}
        workload={test.workload}
        stats={stats}
        source={adapter.source}
        tick={test.workload === 'memo-local-render' ? tick : 0}
      />
    ));
    return <>{adapter.wrap ? adapter.wrap(children, adapter.context) : children}</>;
  }
  const persistenceKey = 'kinstate-comparison-persist-json';
  let unmounted = false;
  try {
    if (test.workload === 'persist-json') {
      // Verify native quota/storage access before timing, with the same projection.
      localStorage.setItem(
        persistenceKey,
        JSON.stringify({ count: adapter.state.count, rows: adapter.state.rows }),
      );
    }
    let started = performance.now();
    flushSync(() => root.render(<Parent />));
    await settle();
    const mountMs = performance.now() - started;
    stats.renders = 0;
    started = performance.now();
    for (let operation = 0; operation < test.operations; operation++) {
      flushSync(() => {
        if (test.workload === 'parent-rerender' || test.workload === 'memo-local-render')
          rerender!();
        else adapter.mutate(operation);
        if (test.workload === 'persist-json')
          localStorage.setItem(
            persistenceKey,
            JSON.stringify({ count: adapter.state.count, rows: adapter.state.rows }),
          );
      });
      await settle();
    }
    const updateMs = performance.now() - started;
    const renders = stats.renders;
    const reference = initialState(test.size);
    for (let operation = 0; operation < test.operations; operation++)
      mutatePlain(reference, test.workload, operation, test.consumers);
    // Validate backing state as well as visible output: offscreen/no-op adapter
    // mistakes must not pass simply because the mounted window is unchanged.
    const actualState = adapter.state;
    for (const key of ['count', 'other', 'unrelated', 'active'] as const) {
      if (actualState[key] !== reference[key])
        throw new Error(`${library}/${test.workload}: incorrect state ${key}`);
    }
    if (
      actualState.nested.value !== reference.nested.value ||
      actualState.rows.length !== reference.rows.length
    )
      throw new Error(`${library}/${test.workload}: incorrect nested state or row count`);
    for (let index = 0; index < reference.rows.length; index++) {
      const actual = actualState.rows[index]!,
        expected = reference.rows[index]!;
      if (
        actual.id !== expected.id ||
        actual.value !== expected.value ||
        actual.active !== expected.active
      )
        throw new Error(`${library}/${test.workload}: incorrect backing row ${index}`);
    }
    for (let index = 0; index < test.size; index++) {
      const actual = actualState.records[index]!,
        expected = reference.records[index]!;
      if (
        actual.id !== expected.id ||
        actual.value !== expected.value ||
        actual.active !== expected.active
      )
        throw new Error(`${library}/${test.workload}: incorrect normalized record ${index}`);
    }
    if (Object.keys(actualState.records).length !== Object.keys(reference.records).length)
      throw new Error(`${library}/${test.workload}: incorrect record key count`);
    if (
      test.workload === 'persist-json' &&
      localStorage.getItem(persistenceKey) !==
        JSON.stringify({ count: reference.count, rows: reference.rows })
    )
      throw new Error(`${library}/${test.workload}: incorrect persisted JSON`);
    const spans = [...element.querySelectorAll('span')];
    if (spans.length !== test.consumers)
      throw new Error(`${library}/${test.workload}: incorrect consumer count`);
    let checksum = 0;
    for (let index = 0; index < spans.length; index++) {
      const expected = String(select(reference, test.workload, index));
      const actual = spans[index]!.textContent;
      if (actual !== expected)
        throw new Error(
          `${library}/${test.workload}/${index}: got ${actual}, expected ${expected}`,
        );
      for (const character of expected) checksum = (checksum * 31 + character.charCodeAt(0)) >>> 0;
      checksum = (checksum * 31 + 124) >>> 0;
    }
    if (
      (test.workload === 'no-op' ||
        test.workload === 'unrelated' ||
        test.workload === 'parent-rerender') &&
      renders !== 0
    )
      throw new Error(
        `${library}/${test.workload}: expected zero consumer renders, received ${renders}`,
      );
    started = performance.now();
    flushSync(() => root.unmount());
    unmounted = true;
    await settle();
    adapter.dispose?.();
    const unmountMs = performance.now() - started;
    return { setupMs, mountMs, updateMs, unmountMs, renders, checksum };
  } finally {
    if (!unmounted) flushSync(() => root.unmount());
    adapter.dispose?.();
    if (test.workload === 'persist-json') localStorage.removeItem(persistenceKey);
    element.remove();
  }
}
