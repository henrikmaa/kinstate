# Scopes and lifecycle

A scope gives service instances an owner. In React, providers establish those scopes; outside React, create and dispose a `ServiceScope` explicitly.

```tsx
import { Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

class CounterService extends Service {
  count = 0;
  increment() {
    this.count++;
  }
}
function Counter() {
  const counter = useService(CounterService);
  return <button onClick={counter.increment}>{counter.count}</button>;
}
export function TwoCounters() {
  return (
    <ServiceProvider services={[CounterService]}>
      <Counter />
      <ServiceProvider services={[CounterService]}>
        <Counter />
      </ServiceProvider>
    </ServiceProvider>
  );
}
```

The inner counter resolves the closest registration and has independent state. There is no application-global fallback. A service resolved from a parent scope retains that parent's identity and dependencies.

## Constructors are not activation

React can construct a service during a render that never commits. Constructors and field initializers must therefore remain inert: no subscriptions, timers, connections or fetches.

Use synchronous lifecycle hooks for resources:

```ts
import { Service } from '@kinstate/core';

class ClockResources {
  timer: ReturnType<typeof setInterval> | undefined;
}
export class ClockService extends Service {
  now = 0;
  private readonly resources = new ClockResources();
  onInit() {
    this.now = Date.now();
    this.resources.timer = setInterval(() => {
      this.now = Date.now();
    }, 1000);
  }
  onDispose() {
    clearInterval(this.resources.timer);
    this.resources.timer = undefined;
  }
}
```

Provider-owned resources initialize after commit. Dependencies initialize before dependents and dispose after them. Hooks run once per activation, not once per object lifetime: React Activity can release resources while retaining state, then reactivate the same instance. Deferred cleanup accommodates immediate Strict Mode effect replay. Make cleanup complete and initialization restartable.

Lifecycle hooks are not awaited. If initialization launches asynchronous work, own cancellation and stale results explicitly. Do not construct or activate new services from cleanup.

## Manual ownership

```ts
import { ServiceScope } from '@kinstate/core';
import { ClockService } from './ClockService';

const scope = new ServiceScope([ClockService]);
const clock = scope.get(ClockService); // Inert so far.
scope.start();
console.log(clock.now);
scope.dispose();
```

`start()` activates manually owned resources. `acquire()` switches the scope to lease-managed activation and returns an idempotent release function; after that switch, releasing the last lease can deactivate the scope even if `start()` was called earlier. Keep one ownership mode per scope. Active child scopes retain their ancestors' resources; release or dispose children before terminally disposing a parent. Premature parent disposal throws.

An explicitly supplied React `scope` remains externally owned and must be disposed by its owner. Registration tokens, `initialState`, parent scope and supplied scope are fixed for a mounted provider. Keep initial configuration stable; use a different React `key` to replace the scope. Live [input values](external-state.md) can change without replacing the service or its local draft.
