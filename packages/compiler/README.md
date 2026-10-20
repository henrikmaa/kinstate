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

For Babel, use `plugins: ['module:@kinstate/compiler']`; `module:` prevents Babel's automatic package-name rewriting. Next.js uses `presets: ['next/babel']` with this plugin. The included Next.js 16 App Router example uses Turbopack by default and also provides webpack scripts.

Components keep their authored `useService(Class)` API. The transform adds a render-frame hook, captures synchronous reads and seals each return. It does not wrap components or use React internals. Generated code opts out of React Compiler memoization until interoperability is verified.

Type syntax and JSX remain intact for downstream transforms. Source maps are returned by the Vite adapter. Vite adapter options: `include?: RegExp`, `importSource?: string`.

The transform diagnoses custom-hook consumption, async service consumers, opaque service escapes and service-dependent memoization. Custom component props accept evaluated primitive/plain data and ordinary on* commands; runtime boundary guards reject live reactive object escapes. Deferred render callbacks capturing service state remain diagnosed. Effects and command callbacks may use stable service references in dependency arrays; useMemo must not conceal reactive reads. Resolve the service in the component that performs those reads.

Use matching 0.1.x React/compiler packages. ESM, MIT.


## Compiler maintenance

The plugin runs a fixed pipeline: discover imports and owners, prepare each component, analyze bindings and install boundary guards, instrument reads, then install frame setup. Source order, identifier allocation, traversal order and diagnostic precedence are part of the compiler contract.

`context.ts` separates growing analysis facts from read-only transform inputs. `analysis.ts` exposes the ordered analysis/guard pipeline; `instrumentation.ts` maps syntax visitors to dedicated read, pattern and iteration transforms. React call recognition has one owner in `react-calls.ts`. Each module documents its AST mutation and scope assumptions.

The characterization suite freezes complete generated code, source maps and diagnostics for 39 pre-refactor programs. Run the compiler tests from the workspace root with `npx vitest run packages/compiler/test`; existing execution and React integration tests additionally verify runtime behavior. Review golden changes as public compiler behavior changes, rather than regenerating them to accept a refactor.


## Reactive component props

Use `kinstate({ reactiveProps: true })` with Vite for ordinary client component modules. For Next.js, use `plugins: [['module:@kinstate/compiler', { reactiveProps: 'client' }]]` and mark receiving-component modules with `'use client'`. Both endpoints must be compiled against the same runtime package. This permits live objects and synchronous render callbacks to cross into compiled receivers, where actual reads are collected. Uncompiled third-party targets still require evaluated values.

Props mode reserves PascalCase functions/default function exports for components. Move whole-parameter defaults/rest and lexical destructuring defaults into the function body, and use separate variable declarations for components. The module directive `'use no service tracking'` excludes infrastructure from props-mode discovery while explicit useService consumers remain tracked. Runtime packages carry this directive to prevent reinstrumentation by transpilePackages.

Dependency files under node_modules are excluded from Babel instrumentation as well as the Vite adapter. Publish consuming components precompiled; this prevents Next.js/framework infrastructure and already compiled libraries from being transformed again.
