# Compose React components

Every direct consumer can resolve the same scoped service independently. This is the simplest way to keep reads near the component that presents them:

```tsx
import { useService } from '@kinstate/react';
import { UserService } from './UserService';

export function UserName() {
  const users = useService(UserService);
  return <span>{users.selectedUser.name}</span>;
}
```

`UserService` is your application service and must be registered above the component. Ordinary parent renders still follow React behavior; property-level subscriptions control state-triggered updates, not every possible cause of rendering.

## Live props to compiled receivers

If a presentational component should receive a live object, enable receiving-component compilation once:

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import kinstate from '@kinstate/compiler/vite';
export default defineConfig({ plugins: [kinstate({ reactiveProps: true }), react()] });
```

Both parent and receiver must be compiled against the same runtime installation:

```tsx
// UserRow.tsx
export function UserRow({ user }: { user: { name: string } }) {
  return <span>{user.name}</span>;
}

// SelectedUser.tsx
import { useService } from '@kinstate/react';
import { UserService } from './UserService';
import { UserRow } from './UserRow';
export function SelectedUser() {
  const users = useService(UserService);
  return <UserRow user={users.selectedUser} />;
}
```

`UserRow` receives the canonical object and subscribes to `name`. Merely passing that object does not subscribe its parent to the nested name. Replacing `selectedUser` updates the parent so it can pass the replacement.

Compiled receiving components also support synchronous render callbacks:

```tsx
import type { ReactNode } from 'react';
function Content({ children }: { children: () => ReactNode }) {
  return <strong>{children()}</strong>;
}
// Inside a compiled service consumer:
// return <Content>{() => counter.count}</Content>;
```

The receiver collects the callback's reads when it invokes it during rendering. Event commands run later and do not become rendering dependencies. Standard `memo` and `forwardRef` relationships preserve receiver identity; arbitrary higher-order wrappers do not acquire this guarantee.

## Third-party boundaries

An uncompiled component cannot transparently observe live service objects or deferred reactive render callbacks. Pass evaluated primitives or plain projections instead. Runtime guards reject unsafe escapes rather than observing every property or cloning the complete state tree.

Props mode reserves PascalCase function bindings and default function exports in selected source for components. Keep utilities outside that convention. Immutable identifier JSX targets are supported; mutable/member targets and async render callbacks remain guarded. Some parameter defaults and rest forms need moving into the body. Read [limitations](limitations.md) before distributing component libraries; dependencies must be precompiled because the plugin excludes `node_modules`.

For App Router, use `reactiveProps: 'client'` and mark receiving modules `'use client'`. See [Next.js and SSR](nextjs-and-ssr.md).
