# React reference

`@kinstate/react` connects scoped services to React 18.3.1 and React 19. The compiler must process consuming source. Services themselves import only the core package.

## useService

```tsx
import { useService } from '@kinstate/react';
import { CounterService } from './CounterService';

export function Count() {
  const counter = useService(CounterService);
  return <button onClick={counter.increment}>{counter.count}</button>;
}
```

`useService(ServiceClass)` returns the inferred service instance from the nearest provider scope. The identity stays canonical. Render-time property reads establish this component's dependencies; event-time commands do not subscribe the component to everything they access.

Call the hook directly in a synchronous component and assign the result to a local binding. The compiler supplies its private frame argument. Do not call internal tracking hooks, hide consumption inside an arbitrary custom hook, or depend on an untransformed fallback. Missing compilation and missing providers produce setup errors.

## ServiceProvider

```tsx
import { ServiceProvider } from '@kinstate/react';
import { serviceInputs } from '@kinstate/core';
import { UserService } from './UserService';
import { UserProfile } from './UserProfile';

export function UserBoundary({ name }: { name: string }) {
  return (
    <ServiceProvider services={[serviceInputs(UserService, { name })]}>
      <UserProfile />
    </ServiceProvider>
  );
}
```

In this example `UserService` declares an own writable `name` field and `UserProfile` consumes that application service.

| Prop           | Meaning                                                              |
| -------------- | -------------------------------------------------------------------- |
| `services`     | Readonly array of service constructors or `serviceInputs` bindings.  |
| `children`     | React content within the scope.                                      |
| `initialState` | Fixed initial `{ service, state }` entries for hydration or seeding. |
| `scope`        | Optional externally owned `ServiceScope`; its owner must dispose it. |

The exported types are `ServiceProviderProps`, `ServiceRegistration` and `InitialServiceState`. Registration tokens and mount-only configuration stay fixed until remount. Keep `initialState` stable across parent renders. A new React key deliberately replaces scope ownership; input values may change without remounting.

An owned provider seeds initial inputs before consumers read. Later bindings publish only during commit. Externally supplied scopes need explicit initial seeding when first-render or SSR output depends on those inputs.

## Lifecycle and composition

Services are constructed inertly during render and activate resources after commit. Immediate Strict Mode replay cancels deferred cleanup. Retained React Activity state can deactivate and reactivate resources without replacing service identity. Hooks must be restartable and cleanup complete.

Each consumer can call `useService` independently. With compiler `reactiveProps` enabled, compiled receiving components can instead observe canonical objects and synchronous render callbacks passed as props. Uncompiled third-party components require evaluated values. See [composition](../guide/react-composition.md) and [scope ownership](../guide/scopes-and-lifecycle.md).

The `@kinstate/react/internal` export is a compiler/runtime protocol, not an application API. Keep compiler and runtime versions aligned and avoid duplicate runtime installations. Server requests need separate scopes and explicit serializable initial data; see [SSR](../guide/nextjs-and-ssr.md).
