# Updating state

Write mutations as ordinary class behavior. A service-owned plain object or array stays reactive through nested access; you do not declare individual observable fields.

```ts
import { Service } from '@kinstate/core';

export class TodoService extends Service {
  title = 'Today';
  items: { id: number; text: string; done: boolean }[] = [];
  private nextId = 1;

  add(text: string) {
    this.items.push({ id: this.nextId++, text, done: false });
  }

  toggle(id: number) {
    const item = this.items.find((item) => item.id === id);
    if (item) item.done = !item.done;
  }

  rename(text: string) {
    this.title = text;
  }
  clearCompleted() {
    this.items = this.items.filter((item) => !item.done);
  }
}
```

React components receive deeply read-only service views from `useService`. Call commands such as `todos.add(text)` or `todos.toggle(id)` to update state; direct assignments and array mutations in components are rejected, including in event handlers. Services retain their ordinary mutable `this` inside methods, and `scope.get` remains mutable outside React.

A compiled component reading only `title` does not subscribe to `items`. A component reading a particular item's `done` field follows that field. Reading array length, membership, keys or individual values establishes different dependencies; structural changes notify the relevant observations.

## Keep related writes together

Synchronous notifications are coalesced. Use `batch` when a group of related writes should form one explicit synchronous transaction, especially outside a service method:

```ts
import { batch, ServiceScope } from '@kinstate/core';
import { TodoService } from './TodoService';

const scope = new ServiceScope([TodoService]);
const todos = scope.get(TodoService);

batch(() => {
  todos.rename('Launch checklist');
  todos.add('Review release notes');
  todos.add('Verify the package');
});

scope.dispose();
```

State reads immediately see assignments. Notification delivery occurs at the shared scheduling checkpoint. React may still retry rendering, so batching does not promise exactly one component function invocation under every concurrent or Strict Mode schedule.

Equality uses `Object.is`: assigning the same primitive or reference suppresses a value change. `NaN` equals itself under this rule; positive and negative zero differ. Object replacement is a change even when the replacement has similar contents.

## Respect ownership

Inside service methods or outside React through `scope.get`, mutate through the service or its canonical nested proxies. If an external variable retains the original raw object, changing that raw reference bypasses proxy notification. Stable proxy identity does not make every alias observable.

Ordinary external objects supplied through `serviceInputs` have a different contract. They are borrowed immutable values, and nested writes are not observed. Replace the input at its owner and publish the replacement; use a separate service-owned draft for editing. See [external state](external-state.md).

Native collections such as `Map` and `Set`, dates and custom nested instances are opaque. Replace their containing property to publish a change, or use plain records and arrays when deep reactivity is needed. Read [limitations](limitations.md) before depending on descriptors, private slots or unusual object identity behavior.

Already-reactive Kinstate objects supplied as inputs retain their canonical identity and existing deep reactivity. Dependency injection is usually clearer for sharing state between services.

Array copies made in a component, such as `service.rows.filter(predicate).sort(compare)`, belong to that component and remain mutable. Elements that still refer to service state are readonly; a new plain projection made by your callback belongs to you.
