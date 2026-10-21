# Compiler reference

The compiler makes reads after `useService()` observable without adding an authored observer wrapper. It inserts explicit render-attempt frames and integrates through the React package's private protocol. It uses documented React subscription APIs rather than global mutable component tracking.

## Vite

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';

export default defineConfig({
  plugins: [kinstate({ reactiveProps: true }), react()],
});
```

The adapter exports a default and named `kinstate` function, plus the `KinstateOptions` type. It runs before JSX lowering, preserves TypeScript syntax for Vite and returns source maps. Dependencies under `node_modules` are excluded; publish precompiled consuming components.

## Next.js 16 (Webpack or Turbopack)

```js
// next.config.mjs
import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
```

The `/next` adapter exports `withKinstate(config?, options?)`. It adds an instrumentation pre-loader, retains SWC, preserves existing bundler configuration, and defaults `reactiveProps` to `'client'`. Remove the old Kinstate Babel configuration; see [Next.js setup](../guide/nextjs-and-ssr.md). This adapter accepts object configuration; for a phase-based config, call it inside your exported config function.

## Babel

For existing Babel pipelines, retain your JSX/TypeScript presets and add `plugins: ['module:@kinstate/compiler']`. The package root exports the plugin and its `CompilerOptions` type. `module:` prevents Babel's package-name normalization.

## Options

| Option          | Default                        | Meaning                                                                                                                                                   |
| --------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `importSource`  | `@kinstate/react`              | Public React package import to recognize; private imports use its `/internal` subpath.                                                                    |
| `reactiveProps` | Disabled                       | `true` instruments receiving components in selected source; `'client'` expands only modules with `'use client'`. Direct service consumers remain tracked. |
| `include`       | JS/TS source extension pattern | Vite-only regular expression selecting source files.                                                                                                      |

Props mode reserves PascalCase function bindings and default function exports for components. An exact module directive, `'use no service tracking'`, excludes infrastructure from props-mode expansion. It does not exempt explicit `useService` consumers from normal tracking and diagnostics.

## Supported transformation

Synchronous reads, getters, method calls, conditional expressions, optional chains, membership, iteration, spreads, arrays and ordinary destructuring are instrumented while preserving evaluation order and receivers. Standard React `memo` and `forwardRef` wrappers are recognized, including supported import aliases and imported compiled receivers.

Instrumentation opts components out of React Compiler optimization with its documented `use no memo` directive. That avoids claiming interoperability with optimizations not verified for this protocol.

## Diagnostics and boundaries

Unsupported escapes are rejected rather than replaced by whole-service subscriptions. Examples include hidden service reads in `useMemo`, uncompiled reactive render callbacks, component returns crossing `finally`, ambiguous reassigned hook-shaped method aliases, and parameter defaults whose lexical environment cannot be preserved. Literal defaults inside destructuring are supported. Read [limitations](../guide/limitations.md) before relying on advanced syntax.

Configure the plugin in both production and tests, and keep its version aligned with `@kinstate/react`. The compiler does not rewrite business classes or provide a global service fallback. Services remain ordinary core objects usable without a compiler outside React; only React dependency capture requires this build step.
