# @kinstate/react

**Ordinary classes. Reactive state.**

Fine-grained service subscriptions for React 18.3 and 19. Requires `@kinstate/core` and build-time `@kinstate/compiler` instrumentation.

```tsx
import { ServiceProvider, useService } from '@kinstate/react';
function Counter() {
  const service = useService(CounterService);
  return <button onClick={() => service.increment()}>{service.count}</button>;
}
<ServiceProvider services={[CounterService]}><Counter /></ServiceProvider>
```

Consumers subscribe to properties read during rendering. Event callbacks use live canonical services without adding render dependencies. Nested providers override registrations. Provider configuration is fixed for a mount; use a new React key to replace it.

`initialState={[{service: CounterService, state: {count: 7}}]}` supplies explicit hydration input. Match the server's initial state on the client. Constructors are inert; owning providers initialize after commit and dispose after unmount. An explicitly supplied `scope` is externally owned and must be disposed by its caller.

Install the Vite adapter or Babel plugin from `@kinstate/compiler`. Uninstrumented use fails explicitly. Each consumer should resolve services itself; passing reactive values to uninstrumented custom children is conservatively rejected by the compiler. `useService` inside custom hooks is not supported.

The `/internal` export is the version-coupled compiler ABI, not a manually authored integration API. ESM, MIT.

## Generic live inputs

Use `serviceInputs(UserService, { user: data, loading })` from core in the provider's `services` array. Values may come from props, context, local React state, or any library hook. Owned scopes seed inputs before rendering; committed updates batch into existing instances. Missing keys preserve state; explicit undefined clears fields that allow it. No RTK dependency or application synchronization effect is required.

Input fields must be public writable data fields with runtime initializers. Callback-valued own fields are supported. Getters, prototype methods, lifecycle hooks and readonly properties are excluded. Callback arguments and returns are type-checked; the own-field versus prototype-method restriction is enforced at runtime because TypeScript represents both with callable signatures. Treat nested external values as borrowed immutable data and keep local edits in separate draft fields. Inputs do not write back to their source. External scopes can preseed `ScopeOptions.inputs` for SSR; `scope.applyInputs()` provides the same React-independent update operation and reports whether values changed. Requires TypeScript 5.4+.

Pass callback inputs with the same helper: `serviceInputs(EditorService, { onSave: saveFromHook })`, where the class declares an initialized writable callback field. Calls return the supplied function unchanged, preserving its identity, values, promises, errors and normal JavaScript receiver semantics. Service methods accessing that field use the latest committed callback. Detached older callbacks remain snapshots. Stable callback identity alone cannot invalidate computations reading hidden external state; bind that state separately.
