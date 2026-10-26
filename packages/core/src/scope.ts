import { batch } from './scheduler.js';
import { applyReactiveInputs, prepareReactiveInputs } from './reactive.js';
import { validateInputBindings, validateInputFields, type ServiceInputBinding } from './inputs.js';
import type {
  Service,
  ServiceConstructor,
  ValidInjection,
  InjectedConstructor,
} from './service.js';

/** Scopes own instance identity and lifecycle; render-time resolution can stay inert. */
export interface ScopeOptions {
  parent?: ServiceScope;
  initialState?: readonly { service: ServiceConstructor; state: Record<string, unknown> }[];
  inputs?: readonly ServiceInputBinding[];
}
export interface ResolveOptions {
  /** Framework integrations defer resource initialization until commit. */
  deferInitialization?: boolean;
}

/** Explicit ownership boundary for service instances and lifecycle resources. */
export class ServiceScope {
  private readonly registrations: Set<ServiceConstructor>;
  private readonly instances = new Map<ServiceConstructor, Service>();
  private readonly resolving: ServiceConstructor[] = [];
  private readonly initialized = new Set<Service>();
  // Constructed by a speculative consumer, but not yet activated by a committed consumer.
  private readonly deferred = new Set<ServiceConstructor>();
  private readonly inputs = new Map<ServiceConstructor, Readonly<Record<string, unknown>>>();
  private started = false;
  private disposed = false;
  private leases = 0;
  private generation = 0;
  private leaseManaged = false;
  private attachedToParent = false;
  private readonly activeChildren = new Set<ServiceScope>();
  private deactivating = false;
  private shutdownPending = false;
  private cleanupDepth = 0;
  private readonly options: Omit<ScopeOptions, 'inputs'>;
  constructor(services: readonly ServiceConstructor[] = [], options: ScopeOptions = {}) {
    this.options = { parent: options.parent, initialState: options.initialState };
    this.registrations = new Set(services);
    validateInputBindings(options.inputs ?? []);
    for (const binding of options.inputs ?? []) {
      if (!this.registrations.has(binding.service))
        throw new Error(`Service inputs require a local registration: ${binding.service.name}`);
      this.inputs.set(binding.service, binding.values);
    }
  }
  /** Apply a committed external-state snapshot; omitted fields retain their current values. */
  applyInputs(bindings: readonly ServiceInputBinding[]): boolean {
    if (this.disposed) throw new Error('Cannot update inputs on a disposed scope');
    validateInputBindings(bindings);
    for (const binding of bindings)
      if (!this.owns(binding.service))
        throw new Error(`Service inputs require local ownership: ${binding.service.name}`);
    const updates = bindings.map((binding) => ({
      binding,
      instance: this.get(binding.service, { deferInitialization: true }),
    }));
    for (const { binding, instance } of updates) validateInputFields(instance, binding.values);
    const publications = updates.map(({ binding, instance }) => {
      const previous = this.inputs.get(binding.service);
      // External identity is the publication boundary. Comparing against the
      // owned instance would copy unchanged payloads on every provider commit
      // and overwrite edits made by service commands.
      const published: Record<string, unknown> = Object.create(null);
      for (const [key, value] of Object.entries(binding.values)) {
        if (!previous || !Object.hasOwn(previous, key) || !Object.is(previous[key], value))
          published[key] = value;
      }
      return { binding, instance, values: prepareReactiveInputs(published) };
    });
    // Reflection over external payloads can execute Proxy traps. Finish all
    // preparation and revalidate targets before publishing any observable state.
    for (const { instance, values } of publications) validateInputFields(instance, values);
    return batch(() => {
      let changed = false;
      for (const { binding, instance, values } of publications) {
        changed = applyReactiveInputs(instance, values) || changed;
        this.inputs.set(binding.service, {
          ...this.inputs.get(binding.service),
          ...binding.values,
        });
      }
      return changed;
    });
  }
  private owns(token: ServiceConstructor): boolean {
    return this.registrations.has(token) || this.instances.has(token);
  }
  private ancestor(token: ServiceConstructor): ServiceScope | undefined {
    for (let scope = this.options.parent; scope; scope = scope.options.parent)
      if (scope.owns(token)) return scope;
  }
  get<C extends ServiceConstructor>(
    token: C & ValidInjection<C>,
    options?: ResolveOptions,
  ): InstanceType<C>;
  get<T extends Service>(token: ServiceConstructor<T>, options: ResolveOptions = {}): T {
    if (this.disposed) throw new Error('Cannot resolve a service from a disposed scope');
    if (this.shutdownPending)
      throw new Error('Cannot resolve a service after scope startup failed');
    if (this.cleanupDepth) return this.existingForCleanup(token) as T;
    if (!this.owns(token)) {
      const ancestor = this.ancestor(token);
      if (ancestor) return ancestor.get(token, options);
    }
    const existing = this.instances.get(token);
    if (existing) {
      if (!options.deferInitialization) {
        this.deferred.delete(token);
        if (this.started && !this.initialized.has(existing)) {
          for (const dependency of (token as InjectedConstructor).inject ?? [])
            this.activate(dependency);
          try {
            this.initialize(existing);
          } catch (error) {
            this.instances.delete(token);
            throw error;
          }
        }
      }
      return existing as T;
    }
    if (this.resolving.includes(token))
      throw new Error(
        `Circular service dependency: ${[...this.resolving, token].map((t) => t.name).join(' -> ')}`,
      );
    this.resolving.push(token);
    try {
      const inject = (token as InjectedConstructor).inject ?? [];
      if (token.length > inject.length)
        throw new Error(`${token.name} requires a static inject = dependencies(...) declaration`);
      const instance = new token(
        ...inject.map((dependency) =>
          this.started && !options.deferInitialization
            ? this.activate(dependency)
            : this.get(dependency, options),
        ),
      );
      const initial = this.options.initialState?.find((entry) => entry.service === token);
      if (initial)
        for (const [key, value] of Object.entries(prepareReactiveInputs(initial.state))) {
          if (
            key === '__proto__' ||
            key === 'constructor' ||
            key === 'prototype' ||
            typeof (instance as unknown as Record<string, unknown>)[key] === 'function'
          )
            throw new Error(`Invalid initial state property: ${key}`);
          if (!Reflect.set(instance, key, value))
            throw new Error(`Initial state property is not writable: ${key}`);
        }
      const inputs = this.inputs.get(token);
      if (inputs) {
        validateInputFields(instance, inputs);
        applyReactiveInputs(instance, inputs);
      }
      this.instances.set(token, instance);
      if (options.deferInitialization) this.deferred.add(token);
      if (this.started && !options.deferInitialization) {
        try {
          this.initialize(instance);
        } catch (error) {
          this.instances.delete(token);
          throw error;
        }
      }
      return instance;
    } finally {
      this.resolving.pop();
    }
  }
  private initialize(instance: Service): void {
    if (this.initialized.has(instance)) return;
    this.initialized.add(instance);
    try {
      instance.onInit();
    } catch (error) {
      this.initialized.delete(instance);
      try {
        this.cleanup(() => instance.onDispose());
      } catch (disposeError) {
        throw new AggregateError(
          [error, disposeError],
          'Service initialization and cleanup failed',
        );
      }
      throw error;
    }
  }
  /** Cleanup may read constructed dependencies, but must never resurrect resources. */
  private existingForCleanup(token: ServiceConstructor): Service {
    if (this.disposed) throw new Error('Cannot resolve a service from a disposed scope');
    const instance = this.instances.get(token);
    if (instance) return instance;
    if (!this.owns(token)) {
      const ancestor = this.ancestor(token);
      if (ancestor) return ancestor.existingForCleanup(token);
    }
    throw new Error('Cannot create or initialize services during scope cleanup');
  }
  private cleanup<T>(action: () => T): T {
    this.cleanupDepth++;
    try {
      return action();
    } finally {
      this.cleanupDepth--;
    }
  }
  private assertActivationAllowed(): void {
    if (this.cleanupDepth) throw new Error('Cannot activate services during scope cleanup');
  }
  /** Explicit owners retain resources until disposal; acquire() opts into lease ownership. */
  start(): void {
    this.assertActivationAllowed();
    if (this.shutdownPending) throw new Error('Cannot start a scope after startup failed');
    this.generation++;
    this.leaseManaged = false;
    this.begin();
  }
  private attach(): void {
    this.assertActivationAllowed();
    if (this.disposed || this.deactivating || this.shutdownPending)
      throw new Error('Cannot activate a disposed, deactivating, or failed scope');
    if (this.attachedToParent || !this.options.parent) return;
    const parent = this.options.parent;
    parent.attach();
    parent.activeChildren.add(this);
    parent.generation++;
    this.attachedToParent = true;
  }
  private detach(): void {
    if (!this.attachedToParent) return;
    this.attachedToParent = false;
    const parent = this.options.parent!;
    parent.activeChildren.delete(this);
    parent.generation++;
    parent.scheduleDeactivation();
    // An ancestor used solely as a lifetime bridge must not hold its own parent forever.
    if (!parent.started && !parent.leases && !parent.activeChildren.size) parent.detach();
  }
  private begin(): void {
    if (this.disposed) throw new Error('Cannot start a disposed scope');
    this.attach();
    this.started = true;
    try {
      for (const token of this.registrations) this.get(token);
      for (const [token, instance] of this.instances)
        if (!this.deferred.has(token)) this.initialize(instance);
    } catch (error) {
      if (this.activeChildren.size) {
        // Committed descendants may already use dependencies initialized before a
        // later registration failed. Their cleanup still needs those resources.
        this.shutdownPending = true;
        this.generation++;
        throw error;
      }
      try {
        this.dispose();
      } catch (disposeError) {
        throw new AggregateError([error, disposeError], 'Scope startup failed');
      }
      throw error;
    }
  }
  /** Commit one deferred dependency graph without activating abandoned renders. */
  activate<C extends ServiceConstructor>(token: C & ValidInjection<C>): InstanceType<C> {
    this.assertActivationAllowed();
    if (this.disposed) throw new Error('Cannot activate a disposed scope');
    if (this.shutdownPending) throw new Error('Cannot activate a scope after startup failed');
    if (!this.owns(token)) {
      const ancestor = this.ancestor(token);
      if (ancestor) return ancestor.activate<C>(token);
    }
    this.attach();
    const previous = new Set(this.initialized);
    this.started = true;
    try {
      return this.get<C>(token);
    } catch (error) {
      const errors: unknown[] = [error];
      this.cleanup(() => {
        for (const instance of [...this.instances.values()].reverse())
          if (this.initialized.has(instance) && !previous.has(instance)) {
            this.initialized.delete(instance);
            try {
              instance.onDispose();
            } catch (disposeError) {
              errors.push(disposeError);
            }
          }
      });
      if (!this.initialized.size && !this.leases && !this.activeChildren.size) {
        this.started = false;
        this.detach();
      }
      if (errors.length > 1)
        throw new AggregateError(errors, 'Service activation and cleanup failed');
      throw error;
    }
  }
  acquire(): () => void {
    this.assertActivationAllowed();
    if (this.disposed) throw new Error('Cannot acquire a disposed scope');
    this.leases++;
    this.generation++;
    this.leaseManaged = true;
    try {
      this.begin();
    } catch (error) {
      this.leases--;
      this.generation++;
      this.scheduleDeactivation();
      throw error;
    }
    let active = true;
    return () => {
      if (!active) return;
      active = false;
      this.leases--;
      this.generation++;
      this.scheduleDeactivation();
    };
  }
  private scheduleDeactivation(): void {
    if (this.disposed || this.activeChildren.size) return;
    if (this.shutdownPending) {
      const generation = this.generation;
      queueMicrotask(() => {
        if (!this.disposed && !this.activeChildren.size && generation === this.generation)
          this.dispose();
      });
      return;
    }
    if (this.disposed || !this.leaseManaged || this.leases || this.activeChildren.size) return;
    const generation = this.generation;
    // Child cleanup detaches its lifetime hold before an ancestor may deactivate.
    // Immediate reacquisition (including Strict Mode replay) cancels this checkpoint.
    queueMicrotask(() => {
      if (
        !this.disposed &&
        this.leaseManaged &&
        !this.leases &&
        !this.activeChildren.size &&
        generation === this.generation
      )
        this.deactivate();
    });
  }
  private deactivate(): void {
    this.generation++;
    this.started = false;
    this.deactivating = true;
    const errors: unknown[] = [];
    this.cleanup(() => {
      for (const instance of [...this.instances.values()].reverse())
        if (this.initialized.has(instance)) {
          this.initialized.delete(instance);
          try {
            instance.onDispose();
          } catch (error) {
            errors.push(error);
          }
        }
    });
    this.initialized.clear();
    this.deactivating = false;
    this.detach();
    if (errors.length) throw new AggregateError(errors, 'Service disposal failed');
  }
  dispose(): void {
    if (this.disposed) return;
    if (this.cleanupDepth) throw new Error('Cannot dispose a scope during cleanup');
    if (this.activeChildren.size)
      throw new Error(
        'Cannot dispose a scope with active child scopes; dispose or release children first',
      );
    this.disposed = true;
    this.generation++;
    try {
      this.deactivate();
    } finally {
      this.instances.clear();
      this.deferred.clear();
      this.inputs.clear();
    }
  }
}

/** Create an inert standalone instance. Use a scope to own resource lifecycle. */
export function createService<C extends ServiceConstructor>(
  token: C & ValidInjection<C>,
): InstanceType<C> {
  return new ServiceScope([token]).get<C>(token);
}
