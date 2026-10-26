# @kinstate/compiler

**Ordinary classes. Reactive state.**

Explicit per-render dependency instrumentation for `@kinstate/react`.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';
export default defineConfig({ plugins: [kinstate(), react()] });
```

For Babel, use `plugins: ['module:@kinstate/compiler']`; `module:` prevents Babel's automatic package-name rewriting. For Next.js 16, use the SWC-preserving adapter below with Webpack or Turbopack; remove any earlier Kinstate `next/babel` configuration.

```js
// next.config.mjs
import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
```

The adapter accepts a Next configuration object, preserves existing bundler rules/hooks, and defaults `reactiveProps` to `'client'`. Pass optional compiler options as the second argument. For phase-based configs, call it inside your exported config function. Tracking is a Babel parser prepass that preserves TypeScript/JSX; Next's SWC remains responsible for its normal transforms. A project-level Babel config still makes Next use Babel; the adapter does not override Next's choice. This is not a native SWC WASM plugin. The maintained example includes `next/font/local` to catch accidental Babel fallback.

Components keep their authored `useService(Class)` API. The transform adds a render-frame hook, captures synchronous reads and seals each return. Legacy direct-consumer mode does not wrap components. Receiving-component mode adds an implicit React.memo boundary using documented React APIs. Generated code opts out of React Compiler memoization until interoperability is verified.

Type syntax and JSX remain intact for downstream transforms. Source maps are returned by the Vite adapter. Vite adapter options: `include?: RegExp`, `importSource?: string`.

The transform diagnoses custom-hook consumption, async service consumers and unsupported service escapes. Legacy mode (`reactiveProps: false`) also diagnoses service reads concealed by React `useMemo`; custom boundaries require evaluated data and supported commands. With receiving-component instrumentation enabled, ordinary imported React `useMemo` callbacks can read services and live props while retaining dependency-aware caching. Effects and command callbacks may use stable service references in dependency arrays. See the mode-specific contracts below.

Use matching 0.1.x React/compiler packages. ESM, MIT.

## Compiler maintenance

The plugin runs a fixed pipeline: discover imports and owners, prepare each component, analyze bindings and install boundary guards, instrument reads, then install frame setup. Source order, identifier allocation, traversal order and diagnostic precedence are part of the compiler contract.

`context.ts` separates growing analysis facts from read-only transform inputs. `analysis.ts` exposes the ordered analysis/guard pipeline; `instrumentation.ts` maps syntax visitors to dedicated read, pattern and iteration transforms. React call recognition has one owner in `react-calls.ts`. Each module documents its AST mutation and scope assumptions.

The characterization suite freezes complete generated code, source maps and diagnostics for 39 pre-refactor programs. Run the compiler tests from the workspace root with `npx vitest run packages/compiler/test`; existing execution and React integration tests additionally verify runtime behavior. Review golden changes as public compiler behavior changes, rather than regenerating them to accept a refactor.

## Reactive component props

Use `kinstate({ reactiveProps: true })` with Vite for ordinary client component modules. For Next.js, use `withKinstate(nextConfig)` and mark receiving-component modules with `'use client'`. Both endpoints must be compiled against the same runtime package. This permits live objects and synchronous render callbacks to cross into compiled receivers, where actual reads are collected. Uncompiled third-party targets still require evaluated values.

Props mode reserves PascalCase functions/default function exports for components. Move whole-parameter defaults/rest and lexical destructuring defaults into the function body, and use separate variable declarations for components. The module directive `'use no service tracking'` excludes infrastructure from props-mode discovery while explicit useService consumers remain tracked. Runtime packages carry this directive to prevent reinstrumentation by transpilePackages.

Dependency files under node_modules are excluded from Babel instrumentation as well as the Vite adapter. Publish consuming components precompiled; this prevents Next.js/framework infrastructure and already compiled libraries from being transformed again.

## Implicit component memoization

Receiving-component mode (`reactiveProps: true`, or selected `'client'` modules) memoizes actual compiled component bindings with React.memo. Stable props no longer force child bodies to rerun merely because a parent updates local presentation state. Context, local Hook state, and property subscriptions still update those components. Changed props use React's ordinary shallow comparison; a newly created callback or children value can still cause a render. Components must follow React's normal render-purity rules.

The authored API stays unchanged. Emitted component tokens are React.memo exotic components: render them through JSX/createElement, not ordinary function calls. The compiler preserves named/default exports and declaration hoisting. Known authored memo wrappers keep their comparator and receive no additional implicit memo; forwardRef remains supported. Wrapper identities are cached weakly by implementation, contain no service state, and are registered through the ordinary React Refresh transform. Nested component definitions retain React's normal remount behavior when their function identity changes.

## React memoization

With `reactiveProps: true`, or in modules selected by `'client'` mode, authored React `useMemo` remains the integration:

```tsx
const service = useService(CartService);
const label = useMemo(() => formatCurrency(service.total, locale), [service, locale]);
```

The compiler rewrites recognized React memo calls inside instrumented components to a private runtime hook. It collects observable reads during calculation, replays them into each render frame on cache hits, and invalidates the memo when observed versions change. React still checks the authored dependencies; include ordinary React state/props such as `locale` there. Factories must remain synchronous and pure. A service getter shares its computed cache across consumers; React memo caches remain local to their component instance.

The private hook uses React's own memo cell for the value and a per-memo external store, created through `useState`, for dependency metadata. `useSyncExternalStore` reads its cached immutable invalidation token; an effect publishes dependencies after commit. Abandoned renders cannot publish that metadata. Each memo adds Hook cells and subscriptions to its actual observed dependencies. Version validation around subscription/publication can schedule another calculation when state changes during commit; cache retention remains subject to React's normal eviction behavior. No public wrapper or application subscription is required. Legacy mode keeps its existing memo diagnostics.
