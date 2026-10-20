# Verification and release

Use a supported Node.js major (the workspace supports Node.js 22.13+, 24, and newer eligible releases). Install the lockfile exactly with `npm ci`. Keep the three public packages on the same version because generated code uses a compiler/runtime protocol.

## Required checks

```sh
npm run check
npm run test:matrix
npm run build:examples
npx playwright install chromium
npm run test:browser
npm run build:webpack -w @kinstate/example-next
npm run test:browser -- --grep Next.js
npm run test:load:long
npm run bench
npm run bench:smoke
```

`check` builds declarations, typechecks tests and consumers, runs unit and integration tests, and verifies packed packages. The React matrix exercises supported React major versions. Browser tests verify example behavior, compiled receiving-component subscriptions, hydration and request isolation with both Next.js bundlers. Extended load checks verify released scopes, watcher/lifecycle balance and retained heap across event-loop turns. Inspect failures and actual output before describing a release as verified; this document is a procedure, not evidence that a particular checkout has passed every check.

Integration tests assert render counts as well as output. They cover unrelated writes, independent component dependencies, conditional branches, computed equality, nested objects and arrays, batching, async methods, scope isolation, cleanup, Strict Mode replay, subscription races, Suspense transitions, request-local rendering, hydration, class behavior, and standalone services.

Benchmarks execute equivalent workloads against MobX with `observer`, Zustand selectors, and Valtio snapshots. Record runtime/dependency versions and machine context with results. Review notification and render counts alongside timings. Use the production Chromium suite (`npm run bench`), inspect charts and raw samples, and record repeat counts and warmups. Controlled flush checkpoints, GC, and workload selection affect interpretation; do not advertise universal speedups from one run.

## Package verification

```sh
npm run build
npm run test:packages
npm pack -w @kinstate/core
npm pack -w @kinstate/react
npm pack -w @kinstate/compiler
```

The package verification script installs packed artifacts into a temporary consumer project and checks runtime imports and declaration consumption. Inspect each tarball's file list, exports, declaration maps, source maps, license, version, and dependency metadata. Examples must import package exports, never reach into sibling source directories.

Install all three generated tarballs together in a separate application when testing unpublished versions. Applications require React and React DOM; Vite users also need Vite and the React Vite plugin. A successful workspace build alone is insufficient evidence that a package can be consumed externally.

## Release procedure

Update the package versions together, align exact internal dependency versions, and update the changelog. Regenerate and commit the lockfile. Run all required checks and retain benchmark output with its environment context. Confirm a clean installation of the tarballs and both example builds.

Publishing remains a separate explicit action. Verify registry access and package-name availability before any first publication. Do not assume the scoped package names in this repository are already available on npm. Tag a release only after checking the published artifacts match the verified tarballs.

Receiving-component mode is an explicit compiler setting: Vite client source can use reactiveProps: true; Next.js uses reactiveProps: client in use-client modules. Keep normal utilities outside PascalCase component bindings, precompile published consumers, and preserve runtime infrastructure directives. Consult [composition](COMPOSITION.md), [limitations](LIMITATIONS.md), and the [validation record](VALIDATION.md) for the verified support contract.
