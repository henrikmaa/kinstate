# Quick start

This repository contains working local packages and examples. Use Node.js 24.x and npm; CI also covers Node.js 22.13 and newer within the supported Node 22 major.

## Run the maintained example

From the repository root:

```sh
npm ci
npm run build
npm run dev -w @kinstate/example-vite
```

Open the URL printed by Vite. The example includes independent render counters, nested state, external inputs and compiled receiving components. For the App Router example, run `npm run dev -w @kinstate/example-next` after building the packages.

The package names are `@kinstate/core`, `@kinstate/react` and `@kinstate/compiler`. The repository does not publish automatically. The following installation commands apply when consuming a published release; they are not a claim that this checkout has been released to npm:

```sh
npm install @kinstate/core @kinstate/react
npm install --save-dev @kinstate/compiler
```

Within this repository, npm workspaces resolve those packages after `npm ci` and `npm run build`.

## Configure Vite

Run Kinstate before JSX lowering and the React plugin:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';

export default defineConfig({
  plugins: [kinstate({ reactiveProps: true }), react()],
});
```

`reactiveProps` also compiles receiving components that read live reactive props. The [composition guide](react-composition.md) explains that optional mode. Direct `useService` consumers always require compilation. Configure the same plugin in tests that render those components.

## Write a service

```ts
// CounterService.ts
import { Service } from '@kinstate/core';

export class CounterService extends Service {
  count = 0;
  increment() {
    this.count++;
  }
  get doubled() {
    return this.count * 2;
  }
}
```

Keep constructors inert. Resources belong in lifecycle hooks, which run after client commit. Pure fields and getters work before initialization and during server rendering.

## Consume the service

```tsx
// App.tsx
import { ServiceProvider, useService } from '@kinstate/react';
import { CounterService } from './CounterService';

function Counter() {
  const counter = useService(CounterService);
  return (
    <button onClick={() => counter.increment()}>
      Count: {counter.count}; doubled: {counter.doubled}
    </button>
  );
}

export default function App() {
  return (
    <ServiceProvider services={[CounterService]}>
      <Counter />
    </ServiceProvider>
  );
}
```

Call `useService` directly in a synchronous component and keep its result in a local binding. Each component can resolve the same service independently. The returned view has deeply read-only data; use service methods to change it, including in event handlers. No wrapper or manual subscription is required.

If the hook reports that the compiler is missing, check which source files your bundler and test runner process. If it reports a missing provider, move the provider above that consumer. The framework intentionally supplies neither an untracked fallback nor a global service instance.
