# Kinstate

<img src="website/docs/public/kingfisher.png" alt="Kinstate kingfisher mascot" width="128" />

**Ordinary classes. Reactive state.**

Class-based reactive services with property-level React subscriptions. Service classes contain ordinary TypeScript business logic; React consumers call `useService(ServiceClass)`. The compiler is required to track reads made after that hook returns.

Pre-release (`0.1.x`). See the [validation record](docs/VALIDATION.md) and [known boundaries](docs/LIMITATIONS.md) for the tested support contract.

```tsx
import { Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

class CounterService extends Service {
  count = 0;
  name = 'Counter';
  increment() { this.count++; }
  get doubled() { return this.count * 2; }
}

function Counter() {
  const service = useService(CounterService);
  return <button onClick={() => service.increment()}>
    {service.count} / {service.doubled}
  </button>;
}

function App() {
  return <ServiceProvider services={[CounterService]}><Counter /></ServiceProvider>;
}
```

`useService()` returns a stable **read-only consumer view**. Fields, getter results and nested arrays cannot be assigned from a component, including event handlers. Use commands such as `service.rename(name)`; those methods keep writable `this` and support async work. Runtime guards also protect returned objects and promise resolutions. Views differ from the mutable instances returned by `scope.get()` outside React. See [consumer ownership](docs/LIMITATIONS.md#read-only-react-consumers).

Changing `name` does not schedule `Counter`. Primitive fields, nested plain objects, arrays, computed getters, and changing conditional dependencies are supported. Mutations use `Object.is` equality, and methods retain stable bound references. No service-class React imports, component wrappers, selectors, or per-field declarations are required.

## Install from Git

Before a registry release, install the repository as the single `kinstate` package:

```json
{
  "dependencies": {
    "kinstate": "github:henrikmaa/kinstate#main"
  }
}
```

Run `npm install`. Use a commit SHA instead of `main` when pinning an exact revision, and commit your application's lockfile. Git installation requires Git, a supported Node version, and lifecycle scripts enabled. npm prepares the package from source, so its first install also installs build dependencies.

Use these imports in a Git consumer:

```tsx
import { Service } from 'kinstate/core';
import { ServiceProvider, useService } from 'kinstate/react';
```

For Vite, import the plugin from `kinstate/compiler/vite`. For Next.js, import `withKinstate` from `kinstate/compiler/next`; both configure `kinstate/react` tracking automatically. The Babel plugin is available at `kinstate/compiler`. The root `kinstate` entry also exports core APIs and works without React.

The Git package includes self-contained compiled copies of the three maintained packages with shared relative module references. It has no unpublished `@kinstate/*` registry dependencies; compiler dependencies resolve normally through the package manager. React, Vite and Next remain application peers. Do not point each `@kinstate/*` dependency at the same repository URL, or combine Git and scoped registry copies in one application: npm selects the repository root, and separate runtime copies have separate service contexts. Existing examples below use the scoped workspace/release imports; replace `@kinstate/` with `kinstate/` when using the Git distribution. See [installation and release checks](docs/RELEASE.md#git-installation).

## Build and run

Use Node.js 24.x and npm. CI also targets Node.js 22.x, version 22.13 or newer. The packages are ESM and support React 18.3.1 and React 19.

```sh
npm ci
npm run build
npm run dev -w @kinstate/example-vite
```

The Vite example displays independent render counters for count, name, computed values, and list consumers. For the Next.js App Router example:

```sh
npm run build
npm run dev -w @kinstate/example-next
```

Package names are `@kinstate/core`, `@kinstate/react`, and `@kinstate/compiler`. The repository does not publish automatically; see [release and verification instructions](docs/RELEASE.md) for packed-artifact checks.

## Compiler setup

For Vite, run the service plugin before the React plugin:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';

export default defineConfig({ plugins: [kinstate(), react()] });
```

For Next.js 16, keep SWC enabled with the adapter (Webpack and Turbopack):

```js
// next.config.mjs
import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
```

Remove any earlier Kinstate `.babelrc`/`next/babel` setup. See [Next.js and SSR](website/docs/guide/nextjs-and-ssr.md).

For an existing Babel pipeline, add `module:@kinstate/compiler` to `plugins` while retaining your JSX and TypeScript presets. Compile every consumer, including tests. Calling an untransformed `useService` throws a setup error. Do not invoke the internal tracking hook yourself.

Consumers must be synchronous function components, including supported React `memo`/`forwardRef` forms. Call `useService` directly in the component and assign its result to a local variable. Custom-hook consumption is diagnosed. Each consuming component should resolve its own service; see [compiler limitations](docs/LIMITATIONS.md) before passing reactive data through component props or memoization.

Receiving-component mode also inserts implicit React.memo boundaries: stable-prop children can skip parent-driven renders while keeping their own property, context, and local-state updates. Components must follow ordinary React purity rules; emitted component tokens are rendered through JSX/createElement. Changed callback or children identities retain React's normal shallow-prop behavior.

With `reactiveProps: true` for client source (or selected `'client'` modules), ordinary imported React `useMemo` callbacks may read service/live-prop state. The compiler preserves their observable dependencies across cache hits and invalidates them when those reads change. Keep non-service React inputs in the authored dependency array and keep factories synchronous and pure. Legacy compiler mode retains concealed-read diagnostics. See [memoization and composition](docs/COMPOSITION.md).

## Live inputs from any React state source

Use `serviceInputs()` to bind ordinary values from props, context, local state, or another library's hook. No library adapter or synchronization effect is needed in application code.

```tsx
import { serviceInputs, Service } from '@kinstate/core';
import { ServiceProvider } from '@kinstate/react';

class UserService extends Service {
  user: Readonly<User> | undefined = undefined;
  loading = false;
  draft = ''; // Local state stays intact when external inputs change.
  onSave: ((name: string) => Promise<void>) | undefined = undefined;

  save() { return this.onSave?.(this.draft); }

  get name() { return this.user?.name ?? 'No user'; }
}

function UserBoundary({ user, loading, onSave }: {
  user: Readonly<User> | undefined;
  loading: boolean;
  onSave?: (name: string) => Promise<void>;
}) {
  return <ServiceProvider services={[
    serviceInputs(UserService, { user, loading, onSave }),
  ]}><UserProfile /></ServiceProvider>;
}
```

Consumers still call `useService(UserService)`. Changes to supplied fields update existing instances and computed dependencies; unrelated fields retain their state. Inline bindings are supported without `useMemo`. Types check callback parameters and return values, and reject unknown fields, getters, readonly properties, and lifecycle inputs. Prototype method targets are rejected at runtime; TypeScript models method signatures and callable properties alike. Declare input fields with runtime initializers. TypeScript 5.4 or newer is required.

New provider scopes receive initial inputs before consumers render and before `onInit`. Later snapshots publish during the layout commit, never from a pending or abandoned render. Omitted fields keep their latest value; explicitly supply `undefined` to clear a field that allows it. Inputs take precedence over `initialState` for overlapping fields. Registration tokens stay fixed until remount, while supplied values and keys may change. Let the source hook own data Suspense before producing bindings; consumers must not suspend waiting for input changes that require the same pending provider commit.

Callback inputs use the same binding. Pass a function returned by another hook as `onSave`; a service method can call `this.onSave(...)` without importing React. Binding does not execute the supplied function. Inside core services its identity, return value, promise and errors are preserved. React views expose stable callable wrappers so returned state remains protected; those wrappers and their returned promises differ from the original callback/promise. After a committed callback change, service methods read the new function and its closure. Omission keeps the previous callback; explicit `undefined` clears optional callbacks.

A previously detached callback remains a snapshot of that function. A stable bound service method that reads `this.onSave` uses the latest committed input. `useCallback` is optional, useful only when the source needs stable callback identity. Use ordinary callback fields initialized to `undefined` or a default function; prototype methods and lifecycle hooks cannot be replaced. A stable callback reading hidden external mutable state does not invalidate computed getters—pass that state as another input if computations depend on it.

Plain objects and arrays become service-owned copies, so service methods can edit mutable input data without mutating another library's cache. Each field is published when its source value changes by `Object.is`; unchanged references preserve service edits across parent renders. External in-place mutations are not a change signal. Use the originating library's normal API to save edits back, and keep separate drafts when edits must survive refetch replacements. An externally supplied scope receives bindings at commit; preseed it with `new ServiceScope([UserService], { inputs: [serviceInputs(UserService, values)] })` when its initial render or SSR must already contain those values.

## Dependency injection and scopes

```ts
import { dependencies, Service, ServiceScope } from '@kinstate/core';

class CartService extends Service { total = 0; }
class PaymentService extends Service {
  async pay(total: number) {
    const response = await fetch('/api/pay', {
      method: 'POST', body: JSON.stringify({ total }),
      headers: { 'content-type': 'application/json' },
    });
    if (!response.ok) throw new Error('Payment failed');
  }
}
class CheckoutService extends Service {
  static inject = dependencies(CartService, PaymentService);
  constructor(
    private readonly cart: CartService,
    private readonly payment: PaymentService,
  ) { super(); }
  async checkout() { await this.payment.pay(this.cart.total); }
}

const scope = new ServiceScope([CheckoutService]);
try {
  scope.start();
  await scope.get(CheckoutService).checkout();
} finally {
  scope.dispose();
}
```

Dependency tuples are checked against constructor parameter types. Dependencies are resolved automatically; cycles and missing declarations produce errors. Nested providers override listed services and otherwise reuse matching ancestor registrations. A service with no matching ancestor is created in the current scope.

Constructors must be inert. Acquire external resources in synchronous `onInit()` and release them in synchronous `onDispose()`. Provider scopes initialize after commit and release resources after unmount or Activity hiding. Cleanup is deferred by one microtask to accommodate Strict Mode effect replay. Activity showing can reactivate the same instance and state; lifecycle hooks run once per activation, with cleanup between activations. Async business methods are supported; lifecycle promises are not awaited.

Provider registration tokens, `initialState`, and scope identity are fixed for its mounted lifetime; live input values are not. Keep `initialState` identity stable; change the provider's React `key` to replace a scope. An explicitly supplied `scope` is started by the provider but remains caller-owned for disposal.

## Outside React

`new CounterService()` and `createService(CounterService)` create reactive, inert instances. Use `ServiceScope` when lifecycle ownership or injection cleanup is needed. Core has no React dependency.

```ts
import { batch, createService, observe } from '@kinstate/core';

const counter = createService(CounterService);
const stop = observe(() => console.log(counter.doubled));
batch(() => { counter.count++; counter.count++; });
stop();
```

`observe` runs immediately, replaces its synchronous read dependencies on each run, and returns cleanup. Writes notify observers in a coalesced microtask. A synchronous method or explicit `batch` groups mutations; a batch does not remain open across `await`.

## Verification and design

```sh
npm run check
npm run test:matrix
npm run build:examples
npm run test:browser
npm run bench
```

Browser tests require Playwright Chromium: `npx playwright install chromium`. Run `npm run bench` for production Chromium comparisons against MobX, Zustand, and Valtio. Open [the interactive benchmark report](benchmarks/report.html) for charts, render counts, and sample variation. See [benchmark methodology](benchmarks/README.md) for scenarios, fairness choices, and run options. These measurements do not establish universal performance superiority.

Read [architecture and SSR ownership](docs/ARCHITECTURE.md), [limitations](docs/LIMITATIONS.md), and [release checks](docs/RELEASE.md). Tests include render-count assertions, conditional subscriptions, computed equality, nested mutations, Strict Mode, subscription races, Suspense transitions, request isolation, and hydration.

See the [local validation record](docs/VALIDATION.md) for executed versions and results.

Implementation ownership and refactoring invariants are documented in [the maintainer guide](docs/MAINTAINING.md). Current open findings are recorded in [the audit](docs/AUDIT.md).

For API-backed forms, entity changes, dirty drafts, optimistic saves and cancellation, use the tested [API workflow recipe](docs/API-WORKFLOWS.md). Bound external objects are immutable inputs observed by replacement; locally owned service objects remain deeply reactive.

Compiled children can consume live object props and synchronous render callbacks without an additional Hook or observer wrapper. Enable receiving-component tracking once in the compiler configuration; see [component composition](docs/COMPOSITION.md). Run `npm run test:load` or `npm run test:load:long` for sustained lifecycle, subscription and retained-heap checks.

## Documentation site

The dark-only Rspress site lives in `website/`, with scenario guides, API reference, local search and a live compiled service example.

```sh
npm run docs:dev
npm run docs:build
npm run docs:check
npm run docs:test
npm run docs:preview
```

For GitHub Pages, select **GitHub Actions** under **Settings → Pages**. The documentation workflow builds and deploys pushes to `main` using the repository-name base path (`/kinstate/` here). Pull requests build and check without deploying. See [deployment instructions](website/docs/deployment.md) for custom domains and base paths.
