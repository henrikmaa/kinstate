# What is Kinstate?

**Ordinary classes. Reactive state.** Kinstate keeps feature state and business logic in TypeScript classes, then subscribes React components to the properties they actually read.

A cart can own quantities, validation and checkout decisions. Components render that cart and invoke its methods. The class has no React imports and remains usable in Node.js or a test.

```tsx
import { Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

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

function Counter() {
  const counter = useService(CounterService);
  return (
    <button onClick={() => counter.increment()}>
      {counter.count} / {counter.doubled}
    </button>
  );
}

export function App() {
  return (
    <ServiceProvider services={[CounterService]}>
      <Counter />
    </ServiceProvider>
  );
}
```

With the required compiler configured, changing `name` does not schedule `Counter`. Its render reads `count` and `doubled`; those reads establish its dependencies. Conditional reads change those dependencies on subsequent renders. Other components and service instances subscribe independently.

## Three responsibilities

The core package owns observable properties, cached getters, batching and service scopes. Plain objects and arrays owned by a service become reactive without per-field declarations. Public methods retain their service receiver, so a method reference can be used as an event command.

The React package resolves the nearest provider and integrates subscriptions with `useSyncExternalStore`. There is no mutable global fallback instance. A provider gives a screen, dialog or application section an explicit lifetime.

The compiler captures reads that happen after `useService()` returns. A hook alone cannot discover arbitrary later reads. Instrumentation therefore belongs in the build and test pipelines. Components keep their authored API; they do not need an observer wrapper, selector or snapshot hook.

## Where it fits

Use a service for feature behavior shared by several components, derived business values, or logic you want to test outside React. Keep short-lived presentation details in ordinary React state when that ownership is clearer.

Existing query caches and state libraries can remain authoritative. [External inputs](external-state.md) pass their committed values into a service, while [callback inputs](callbacks.md) let the service request an operation through the original owner. Kinstate does not replace the fetching library or infer how to update its cache.

Start with the [quick start](quick-start.md), then read [state updates](updating-state.md) and [scopes](scopes-and-lifecycle.md). Before adopting the framework broadly, review [performance](performance.md) and [supported boundaries](limitations.md): opaque native objects, compiler coverage and commit-only input synchronization are deliberate constraints.
