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

Consumers subscribe to properties read during rendering. Event callbacks read stable readonly views without adding render dependencies. Fields/getters/nested data are readonly in TypeScript and guarded at runtime; update state through service methods. Nested providers override registrations. Provider configuration is fixed for a mount; use a new React key to replace it.

`initialState={[{service: CounterService, state: {count: 7}}]}` supplies explicit hydration input. Match the server's initial state on the client. Constructors are inert; owning providers initialize after commit and dispose after unmount. An explicitly supplied `scope` is externally owned and must be disposed by its caller.

Install the Vite adapter or Babel plugin from `@kinstate/compiler`. Uninstrumented use fails explicitly. Each consumer should resolve services itself; passing reactive values to uninstrumented custom children is conservatively rejected by the compiler. `useService` inside custom hooks is not supported.

The `/internal` export is the version-coupled compiler ABI, not a manually authored integration API. ESM, MIT.

## Generic live inputs

Use `serviceInputs(UserService, { user: data, loading })` from core in the provider's `services` array. Values may come from props, context, local React state, or any library hook. Owned scopes seed inputs before rendering; committed updates batch into existing instances. Missing keys preserve state; explicit undefined clears fields that allow it. No RTK dependency or application synchronization effect is required.

Input fields must be public writable data fields with runtime initializers. Callback-valued own fields are supported. Getters, prototype methods, lifecycle hooks and readonly properties are excluded. Callback arguments and returns are type-checked; the own-field versus prototype-method restriction is enforced at runtime because TypeScript represents both with callable signatures. Treat nested external values as borrowed immutable data and keep local edits in separate draft fields. Inputs do not write back to their source. External scopes can preseed `ScopeOptions.inputs` for SSR; `scope.applyInputs()` provides the same React-independent update operation and reports whether values changed. Requires TypeScript 5.4+.

Pass callback inputs with the same helper: `serviceInputs(EditorService, { onSave: saveFromHook })`, where the class declares an initialized writable callback field. Core service access preserves the supplied callback and promise identity. React views expose stable callable wrappers with protected object results and promise resolutions; consumer wrapper/promise identity differs from the source. Service methods accessing that field use the latest committed callback. Detached older callbacks remain snapshots. Stable callback identity alone cannot invalidate computations reading hidden external state; bind that state separately.


`useService` returns `ServiceView<T>`, a cached view distinct from `scope.get(T)`'s mutable canonical instance. Commands remain bound to that instance, including after `await`; nested objects, array callback values, reflective descriptors and method results do not expose writable service data. `ServiceView` and `ReadonlyServiceValue` are exported types. Method signatures remain unchanged to preserve generic/overload inference: a method return type can appear mutable even though its returned data is protected at runtime. Fields and getters receive deep readonly types.

Map/Set/Date read operations are supported through views, but these values remain opaque to deep reactivity; replace their owning field through a command to publish changes. Mutators, custom native overrides and methods/accessors on other opaque nested instances are rejected; expose a service method instead. Command arguments that contain views are normalized through cached read-through plain-data adapters, without cloning or rewriting caller containers. Fixed properties needing replacement and opaque/accessor containers are outside that argument-normalization contract. Keep lifecycle calls owned by the provider, and invoke mutation commands from events/effects rather than render.

## React memoization

Enable the compiler's `reactiveProps: true` option for client source, or `'client'` for marked client modules, to use ordinary imported React `useMemo` with service/live-prop reads. The compiler's private runtime hook preserves authored dependencies and collects additional observable dependencies. Cached reads remain subscribed on later renders, and changes to those reads invalidate the memo. Continue listing non-service React inputs in the dependency array and keep the factory synchronous and pure.

No new public hook is required. React owns the memo value; a per-memo external store supplies a cached immutable token through `useSyncExternalStore`, and an effect publishes dependency metadata after commit. Speculative renders cannot replace committed metadata. The extra Hook cells and narrow source subscriptions preserve caching; a commit-time version change can cause another calculation. Legacy compiler mode continues to diagnose hidden service reads inside `useMemo`.
