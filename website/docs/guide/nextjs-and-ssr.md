# Next.js and server rendering

Server rendering needs request-local service ownership. Never put a mutable `ServiceScope` or service instance in a server module singleton. Each request constructs its own graph, and the client constructs a different graph from explicit initial data.

The Next.js 16 App Router adapter supports Webpack and Turbopack while keeping Next's SWC compiler enabled.

## Configure client instrumentation

```js
// next.config.mjs
import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
```

Remove the Kinstate `.babelrc`/`next/babel` setup when moving to this adapter, then restart Next. Clear its generated `.next` cache if stale Babel diagnostics persist. A project-level Babel configuration still makes Next choose Babel. The adapter uses Babel internally for a syntax-preserving tracking prepass; Next's SWC then handles TypeScript, JSX, Server Components and Fast Refresh. This is not a native SWC plugin, and it does not need a version-coupled SWC WASM binary.

`withKinstate` accepts a Next configuration object and optional compiler options as its second argument. It preserves existing Webpack hooks and Turbopack rules. The default `reactiveProps: 'client'` instruments receiving components in explicit `'use client'` modules. Published dependencies must be precompiled; files under `node_modules` are excluded.

Run `next dev --webpack` / `next build --webpack` for Webpack, or use `--turbopack`. Next 16 is the currently verified major. The example includes `next/font/local`, so switching accidentally back to Babel fails its build.

## Send data across the boundary

```ts
// CounterService.ts
import { Service } from '@kinstate/core';
export class CounterService extends Service {
  count = 0;
  increment() {
    this.count++;
  }
}
```

```tsx
// Counter.tsx
'use client';
import { useState } from 'react';
import { ServiceProvider, useService } from '@kinstate/react';
import { CounterService } from './CounterService';

function Display() {
  const counter = useService(CounterService);
  return <button onClick={counter.increment}>{counter.count}</button>;
}
export default function Counter({ count }: { count: number }) {
  const [initialState] = useState(() => [{ service: CounterService, state: { count } }]);
  return (
    <ServiceProvider services={[CounterService]} initialState={initialState}>
      <Display />
    </ServiceProvider>
  );
}
```

```tsx
// page.tsx: server component
import { ServiceScope } from '@kinstate/core';
import { CounterService } from './CounterService';
import Counter from './Counter';

export default function Page() {
  const scope = new ServiceScope([CounterService]);
  try {
    scope.get(CounterService).count = 7;
    return <Counter count={scope.get(CounterService).count} />;
  } finally {
    scope.dispose();
  }
}
```

The constructor and pure reads run on the server, but `scope.start()` is deliberately absent. No client resources initialize. The client receives a number and seeds its own scope, so the initial server and client markup agree.

`initialState` is fixed configuration for the mounted provider. The state initializer keeps its identity stable. For a different entity, remount with a new key; for ongoing authoritative data updates, use [inputs](external-state.md), not a changing `initialState` array.

## Keep serialization explicit

Do not serialize service instances, closures, query clients or secrets. Use JSON-safe DTOs and validate them at the application boundary. Ordinary callback inputs belong inside a client component; service methods are not Next.js Server Actions.

With `reactiveProps: 'client'`, put `'use client'` on receiving-component modules too. Dependencies under `node_modules` must already be compiled. Source hooks own loading and Suspense before producing bindings; a service input is a committed snapshot, not a speculative Server Component data channel.

For another SSR renderer, follow the same ownership rule: one server scope per request, explicit disposal, no implicit activation, and equivalent client initial data for hydration.
