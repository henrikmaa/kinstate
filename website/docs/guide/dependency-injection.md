# State from another service

Inject a service when another service needs its state or behavior. A typed static tuple declares constructor dependencies once; service classes do not import React or resolve a global registry.

```ts
import { dependencies, Service, ServiceScope } from '@kinstate/core';

export class CartService extends Service {
  total = 0;
}

export class PaymentService extends Service {
  async pay(total: number) {
    const response = await fetch('/api/pay', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ total }),
    });
    if (!response.ok) throw new Error('Payment failed');
  }
}

export class CheckoutService extends Service {
  static inject = dependencies(CartService, PaymentService);

  constructor(
    private readonly cart: CartService,
    private readonly payment: PaymentService,
  ) {
    super();
  }

  get amountDue() {
    return this.cart.total;
  }
  async checkout() {
    await this.payment.pay(this.cart.total);
  }
}

const scope = new ServiceScope([CheckoutService]);
const checkout = scope.get(CheckoutService);
scope.start();
// Invoke checkout.checkout() from an application command.
scope.dispose();
```

The scope constructs transitive dependencies as needed. The tuple is checked against constructor parameter types, and runtime resolution reports missing injection declarations and dependency cycles with service names. Constructor arguments are service dependencies; use [inputs](external-state.md) for API values, React state and callbacks.

## Cross-service computations

`amountDue` reads `CartService.total` through the injected canonical instance. An observation of that getter follows the cart property automatically. There is no copying step and no synchronization effect. Methods can invoke methods on other injected services, including async operations.

An injected service can itself have dependencies. Keep this graph understandable: a cycle such as checkout → payment → checkout is an ownership problem to redesign, not a reason to introduce a hidden singleton.

## Respect scope boundaries

Resolution uses local registrations first, then matching ancestor ownership. A nested provider can override a service for a dialog or feature instance. Dependencies are resolved in the scope constructing their dependent.

An existing parent-owned `CheckoutService` retains its original injected cart. Registering a different cart below it does not rewrite an already constructed parent's dependencies. To create a feature-specific checkout graph, register both `CheckoutService` and its overridden `CartService` in that nested scope.

Dependencies initialize before dependents and dispose after them. Constructors must still be inert: React may construct a graph for an abandoned render. Initial input fields are applied after a service's own constructor, before dependent construction and lifecycle activation. If initialization needs those fields, use `onInit` rather than reading them in that service's constructor.

See [scopes and lifecycle](scopes-and-lifecycle.md) for resource ownership, and [the core reference](../reference/core.md) for scope methods.
