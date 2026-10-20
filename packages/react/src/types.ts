import type { ServiceConstructor, ServiceInputBinding, ServiceScope } from '@kinstate/core';
import type { ReactNode } from 'react';

export interface InitialServiceState {
  service: ServiceConstructor;
  state: Record<string, unknown>;
}

/** Constructors register local services; bindings also provide live external state. */
export type ServiceRegistration = ServiceConstructor | ServiceInputBinding;

export interface ServiceProviderProps {
  services: readonly ServiceRegistration[];
  children?: ReactNode;
  initialState?: readonly InitialServiceState[];
  /** Externally owned scopes must be disposed by their owner. */
  scope?: ServiceScope;
}
