# Test behavior and render isolation

Service logic can be tested without React. An explicit scope makes instance ownership and cleanup visible; `flushSync` provides a deterministic core notification checkpoint.

```ts
import { describe, expect, it } from 'vitest';
import { observe, Service, ServiceScope, flushSync } from '@kinstate/core';

class CounterService extends Service {
  count = 0;
  name = 'Counter';
  increment() {
    this.count++;
  }
  get doubled() {
    return this.count * 2;
  }
}

describe('CounterService', () => {
  it('notifies only observed changes', () => {
    const scope = new ServiceScope([CounterService]);
    const counter = scope.get(CounterService);
    let runs = 0;
    const stop = observe(() => {
      void counter.doubled;
      runs++;
    });
    try {
      counter.name = 'Other';
      flushSync();
      expect(runs).toBe(1);
      counter.increment();
      flushSync();
      expect(counter.doubled).toBe(2);
      expect(runs).toBe(2);
    } finally {
      stop();
      scope.dispose();
    }
  });
});
```

Call `scope.start()` when the behavior under test requires `onInit`. A test of pure fields does not need resource activation. Mock transport or callback inputs at the service boundary rather than putting React mocks inside the class.

## Compile React tests

Configure the Kinstate Vite plugin in Vitest, just as in the application:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import kinstate from '@kinstate/compiler/vite';
export default defineConfig({
  plugins: [kinstate({ reactiveProps: true })],
  test: { environment: 'jsdom' },
});
```

Install the test runner, DOM environment and Testing Library in your application. An untransformed consumer throws a compiler setup error; tests should not bypass the internal render-frame protocol.

For a mounted test, keep render counters outside observable state. Render a count-only consumer and a name-only consumer under the same provider. Mutate count inside Testing Library `act`, call the core `flushSync` checkpoint, then assert both the DOM and which counters changed. This proves selection behavior; checking only the DOM cannot detect unnecessary renders.

Use separate component instances to verify independent subscriptions. Switch a conditional read, then mutate its formerly active field to confirm dependency cleanup. Unmount before another write and check that resources and notifications stop.

## Include application failure policies

Test stale async completions, callback replacement, draft preservation during refetch, request failure, entity switches and reset. Use a transport mock that ignores abort in at least one test; generation guards should still reject stale results. For SSR, create two request scopes and hydrate explicit initial data.

The repository's verification commands include `npm test`, `npm run test:matrix`, `npm run test:packages`, `npm run build:examples` and `npm run test:browser`. The matrix restores locked dependencies afterward. Packed-consumer checks matter because workspace resolution can hide missing exports or declarations.

React Strict Mode and concurrent scheduling can add render attempts. Assert the relevant relationships and committed output rather than treating a universal exact render count as an API guarantee.
