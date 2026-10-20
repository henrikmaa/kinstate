import { Service, ServiceScope, createService, dependencies } from '../src/index.js';
class Cart extends Service {
  total = 0;
}
class User extends Service {
  name = '';
}
class Valid extends Service {
  static inject = dependencies(Cart);
  constructor(readonly cart: Cart) {
    super();
  }
}
class Wrong extends Service {
  static inject = dependencies(User);
  constructor(readonly cart: Cart) {
    super();
  }
}
class Missing extends Service {
  constructor(readonly cart: Cart) {
    super();
  }
}
const scope = new ServiceScope();
scope.get(Valid).cart.total;
createService(Valid).cart.total;
// @ts-expect-error Injection tuple does not satisfy the constructor.
scope.get(Wrong);
// @ts-expect-error Required constructor arguments need an injection tuple.
scope.get(Missing);
// @ts-expect-error Injection tuple does not satisfy the constructor.
createService(Wrong);
// @ts-expect-error Required constructor arguments need an injection tuple.
createService(Missing);
