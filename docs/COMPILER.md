# Maintaining the compiler

The compiler transforms authored `useService` consumers through explicit Babel paths. Its runtime protocol is the React package's internal render frame. No compiler module imports the runtime to perform a transformation.

The Next.js adapter (`next.ts`) composes documented Webpack/Turbopack configuration. Its small CommonJS loader (`next-loader.cts`) calls the syntax-preserving transform in `next-transform.ts`; it does not install `next/babel` or replace SWC. Configuration and transformation are tested separately, and clean packed consumers exercise the emitted loader. Next owns TypeScript/JSX lowering, Server Component transforms and Fast Refresh.

## Pass order and mutation contracts

| Stage | Owner | Inputs and effects |
| --- | --- | --- |
| Import facts | `imports.ts` | Reads authored imports. Returns read-only name sets; allocates no generated identifiers. |
| Consumer discovery | `discovery.ts` | Reads the complete program and records owner paths and hook calls in source order before changing function bodies. |
| Component preparation | `component.ts` | Checks supported owner/call forms, normalizes concise bodies, allocates the frame identifier and adds the private hook argument. Creates mutable binding facts. |
| Binding analysis | `binding-analysis.ts` | Grows service aliases and derived bindings to a fixed point. Validates assignment escapes while discovering derived values. Does not rewrite syntax. |
| Business-call normalization | `business-calls.ts` | Distinguishes service methods from Hooks when their names resemble Hooks. Preserves member receivers and evaluation order; updates binding facts when renaming local method aliases. |
| Service validation | `service-validation.ts` | Checks reassignment and service reference escapes. Reads completed binding facts. |
| JSX guards | `component-boundaries.ts` | Installs guards on custom attributes, then checks nested captures and guards children in a second traversal. |
| Call guards and validation | `analysis.ts` | In one traversal, installs factory guards before validating memo calls. Keeping these operations interleaved preserves traversal behavior and diagnostic precedence. |
| Read instrumentation | `instrumentation.ts` | Uses exit visitors for expression reads and constructor invocations; delegates chain/reference handling, patterns and iteration. Seals component returns without sealing ordinary callback returns. |
| Frame installation | `component.ts` | Adds the documented memoization opt-out, frame hook and fallthrough finish only after instrumentation, so generated setup is not transformed. |
| Program import | `plugin.ts` | Inserts the generated internal hook import after all component owners are processed. |

The orchestrator intentionally says `analyzeAndGuardComponent`: this stage includes AST rewrites. `MutableComponentContext` grants binding discovery permission to grow sets; validators and transforms accept `ComponentContext`, whose facts are read-only. This is a TypeScript ownership contract, not a deeply frozen Babel tree. Babel paths remain mutable and their identities identify owners.

## Syntax ownership

- `react-state-setters.ts` proves stable second-tuple dispatch bindings from imported React `useState`/`useReducer`, including aliases. Initial values may be service-derived; this does not grant trust to state-held callback values or shadowed hooks.
- `boundary-callbacks.ts` certifies individual callbacks using lexical captures, without replacing callback identities or executing their bodies. The React runtime owns weak certificates and primitive-capture checks in `callback-boundaries.ts`. Unknown derived factories, mutable captures and shadowed declaration captures remain guarded. Deferred callback validation also applies to compiled receivers.
- `react-calls.ts` owns recognition of supported React hooks, component wrappers and element factories. Keep import-alias policy consistent with `imports.ts`.
- `business-calls.ts` normalizes Hook-shaped service method names before validation/instrumentation. Actual React import bindings must retain their Hook semantics; an ordinary service method must still collect synchronous reads.
- `ast.ts` contains shared predicates for nested consumers, hook-shaped calls and write targets.
- `read-collection.ts` owns synchronous collection callbacks, generated-node exclusion, optional-chain continuity and receiver-preserving reference operands. Parentheses and TypeScript wrappers have different implications for optional chains; do not collapse their handling without semantic tests.
- `patterns.ts` collects destructuring evaluation while exposing bindings in the authored scope.
- `iteration.ts` validates loop headers before allocating replacement identifiers or rewriting the loop. It retains the original body as a separate scope, leaves labels and iterator cleanup native, and rebuilds Babel scope data after introducing bindings.

Nested consumers have independent frames; ordinary synchronous callbacks can participate in their owner's reads. Hook calls and asynchronous boundaries cannot move inside collection callbacks. Generated collection calls must not be collected again. Small predicates encode these distinctions so the visitor table remains readable.

Binding discovery currently uses conservative name sets. Replacing these with Babel binding identities is a separate behavior change: loop lowering rebuilds scope metadata. Do not combine that redesign with module extraction. Likewise, changing a diagnostic or allowing new syntax requires a focused correctness change.

## Extending the compiler

1. Identify the semantic owner: import recognition, analysis, validation, boundary handling, or syntax instrumentation. Keep new syntax mechanics out of the plugin orchestrator.
2. Add an execution regression for evaluation order, receiver identity, lexical scope or dependency capture as applicable. Check invalid inputs and hook placement as well as accepted syntax.
3. Review full generated code, diagnostics and source maps. The 39-program characterization corpus records pre-refactor behavior independently of internal module structure. Do not regenerate it just to make refactoring pass.
4. Run `npx vitest run packages/compiler/test`, `npm run typecheck`, `npm run check:boundaries`, and `npm run check:hooks`. Run cross-package React tests and packed-consumer verification for every change to generated output or the compiler/runtime protocol.
5. Build both examples and run browser tests when plugin integration changes. Use the React compatibility matrix when runtime tracking semantics change. A behavior-preserving module refactor does not require replacing benchmark measurements.

Keep diagnostic precedence and generated identifier allocation deterministic. A source-map or golden mismatch is evidence to inspect, even when rendered output is unchanged. Public exports and plugin options remain separate from internal pass contracts.


## Optional receiving-component instrumentation

`reactiveProps` adds a discovery pass for receiving functions and compiler-proven React wrapper relationships. It runs before syntax mutation, registers actual component identities through weak runtime metadata, and still allocates a distinct frame for each render attempt. Wrapper-only modules do not receive an unnecessary Hook. Receiver parameter lowering and callback diagnostics have dedicated execution regressions; preserve parameter mutability, initializer order and lexical scope, and diagnose forms whose semantics cannot be preserved.

`true` selects client source; `'client'` restricts expansion to modules with `'use client'`. Dependency files under node_modules are excluded and must be distributed precompiled. The exact `'use no service tracking'` directive excludes framework infrastructure from props expansion while explicit useService consumers retain normal tracking. These exclusions prevent Next.js transpilation from treating provider/Next infrastructure as application receivers.

The receiver registry trusts only explicit compiler registration and wrapper edges proven to call imported React memo/forwardRef. Never infer trust from a display name, arbitrary HOC, or React implementation properties. Mutable JSX type bindings remain guarded. Keep new composition diagnostics outside the legacy characterization corpus unless the default compiler contract intentionally changes.
