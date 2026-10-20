import { createReactiveService } from './reactive.js';

/** Extend this class; constructors must not acquire external resources. */
export class Service {
  constructor() {
    return createReactiveService(this);
  }
  onInit(): void {}
  onDispose(): void {}
}

export type ServiceConstructor<T extends Service = Service> = new (...args: any[]) => T;
type DependencyInstances<T extends readonly ServiceConstructor[]> = {
  -readonly [K in keyof T]: InstanceType<T[K]>;
};
/** Validates a concrete constructor's declared injection tuple. */
export type ValidInjection<C extends ServiceConstructor> =
  number extends ConstructorParameters<C>['length']
    ? unknown
    : ConstructorParameters<C> extends []
      ? unknown
      : C extends { inject: infer D extends readonly ServiceConstructor[] }
        ? DependencyInstances<D> extends ConstructorParameters<C>
          ? unknown
          : never
        : never;
export function dependencies<const T extends readonly ServiceConstructor[]>(...tokens: T): T {
  return tokens;
}
export type InjectedConstructor = ServiceConstructor & { inject?: readonly ServiceConstructor[] };
