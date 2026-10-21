# Reactive component composition

Enable receiving-component instrumentation once in the compiler setup:

```ts
// Vite: client component source selected by this plugin.
plugins: [kinstate({ reactiveProps: true }), react()]
```

Next.js 16 uses a syntax-preserving instrumentation prepass with either Turbopack or Webpack, retaining SWC:

```js
// next.config.mjs
import { withKinstate } from '@kinstate/compiler/next';

export default withKinstate({
  transpilePackages: ['@kinstate/core', '@kinstate/react'],
  reactStrictMode: true,
});
```

In that mode, put `'use client'` in modules containing receiving components. Server Components remain outside props instrumentation. Functions and live service instances still cannot cross a Server Component serialization boundary.

```tsx
// Parent.tsx
function Parent() {
  const service = useService(UsersService);
  return <UserRow user={service.selectedUser}/>;
}

// UserRow.tsx: also compiled; add 'use client' for Next.js client mode.
export function UserRow({ user }: { user: { name: string } }) {
  return <span>{user.name}</span>;
}
```

The child receives the same cached readonly consumer view. Its own frame subscribes to `name`; the parent does not subscribe to that property merely by passing the object. Replacing `selectedUser` updates the parent and passes the replacement. Ordinary React parent renders still render an unmemoized child, as usual.

Synchronous render callbacks work through the same receiving boundary:

```tsx
function Parent() {
  const service = useService(CounterService);
  return <Content>{() => service.count}</Content>;
}
function Content({ children }: { children: () => React.ReactNode }) {
  return <strong>{children()}</strong>;
}
```

`Content` collects the callback's reads when it invokes the callback during rendering. Calling an event command after rendering does not add rendering dependencies. Conditional reads replace subscriptions on commit, and abandoned renders cannot replace committed dependencies. No global component render state is introduced.

## Boundaries that remain explicit

Only instrumented receivers can consume live reactive values this way. For an uncompiled third-party component, pass evaluated primitives/plain projections or resolve the service in a compiled child that performs those reads. A guard rejects unsafe escapes rather than silently observing the entire service or cloning it. Library authors can precompile receiving components; keep compiler/runtime versions aligned and avoid duplicate runtime installations.

Recognized React memo/forwardRef wrappers preserve their actual wrapper identity. Arbitrary higher-order functions, mutable/member JSX targets and async render callbacks are outside this supported boundary. Whole-parameter defaults/rest must move into the body so evaluation happens after frame creation. Context-free literal defaults inside destructuring are supported; lexical/callback defaults and body-function shadowing of parameters are diagnosed rather than changing initializer scope. Mutable parameter bindings, var redeclarations and initializer order retain ordinary semantics. Compiler diagnostics explain these cases.

Props mode reserves PascalCase function bindings and default function exports for components in selected source. Keep ordinary utility functions outside that convention. The explicit `'use no service tracking'` module directive excludes infrastructure from props-mode discovery; it does not exempt explicit service consumption from normal tracking and diagnostics.

The Vite example has independent parent/child render counters and an imported receiver. Browser tests verify that editing its live row updates the child without rerendering its parent, and that a render callback updates independently.
