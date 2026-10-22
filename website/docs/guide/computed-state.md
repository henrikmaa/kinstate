# Computed state

A getter expresses a synchronous derived value. Kinstate caches service getters, captures the properties they read, and invalidates them when those dependencies change.

```ts
import { Service } from '@kinstate/core';

export class CartService extends Service {
  lines: { id: string; quantity: number; unitPrice: number }[] = [];
  couponPercent = 0;
  includeShipping = false;
  shipping = 5;

  get subtotal() {
    return this.lines.reduce((total, line) => total + line.quantity * line.unitPrice, 0);
  }

  get total() {
    const discounted = this.subtotal * (1 - this.couponPercent / 100);
    return discounted + (this.includeShipping ? this.shipping : 0);
  }
}
```

`total` depends on `shipping` only while `includeShipping` is true. When that branch changes, the getter's dependency set changes too. Getters can depend on other getters and on injected services. A dependency cycle is reported rather than recursing indefinitely.

React consumption remains ordinary property access:

```tsx
import { useService } from '@kinstate/react';
import { CartService } from './CartService';

export function Total() {
  const cart = useService(CartService);
  return <output>{cart.total.toFixed(2)}</output>;
}
```

The surrounding tree must provide `CartService`, and this component must pass through the compiler. The component follows the derived value. Equality-aware propagation can avoid a downstream update when a recomputation produces an `Object.is`-equal result, although checking that result still has a computation cost.

## Keep getters pure

Do not fetch, write observable state, acquire resources or return a promise from a computed getter. A getter can execute lazily when a subscriber validates its snapshot; it is not an effect or a reliable place to run a command.

A getter backed only by a JavaScript `#private` slot cannot observe changes to that slot. Likewise, reading a date, a hidden mutable variable inside a callback, or an opaque native collection does not create a reactive dependency. Expose an observable input or replace the containing property when a change should invalidate the result.

## Use memoization at the right boundary

You do not need React `useMemo` around a service getter: its computed cache is shared by service consumers. When presentation needs a component-local cache, enable `reactiveProps: true` for client source or `'client'` for marked client modules and keep ordinary React memoization:

```tsx
const label = useMemo(() => formatCurrency(cart.total, locale), [cart, locale]);
```

Here `useMemo` comes from React and `formatCurrency` is an application function. The compiler records the factory's observable reads, retains their subscriptions on cache hits, and invalidates the memo when those reads change. Include ordinary React inputs such as `locale` in the dependency array. Keep the factory synchronous and pure; React may still evict caches. In legacy compiler mode (`reactiveProps: false`), concealed reactive reads remain diagnosed.

Large collection getters and memo factories still perform collection work when invalidated. Caching does not make sorting 50,000 reactive rows constant-time. See [performance](performance.md).
