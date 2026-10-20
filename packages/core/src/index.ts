/** Public package boundary. Internal scheduling, atoms, and proxy metadata stay private. */
export { batch, flushSync } from './scheduler.js';
export { collectDependencies, type Dependency } from './dependencies.js';
export { Service, dependencies, type ServiceConstructor, type ValidInjection } from './service.js';
export { serviceInputs, type ServiceInputs, type ServiceInputBinding } from './inputs.js';
export { ServiceScope, createService, type ScopeOptions, type ResolveOptions } from './scope.js';
export { observe } from './observe.js';
export { isReactive } from './reactive.js';
