'use client';
'use no service tracking';

import { ServiceScope, type ServiceConstructor, type ServiceInputBinding } from '@kinstate/core';
import { useContext, useEffect, useState } from 'react';
import { ScopeContext } from './context.js';
import { InputCommit } from './input-commit.js';
import type { ServiceProviderProps } from './types.js';

/** Registration tokens and hydration input are fixed; binding values are live. */
export function ServiceProvider({ services, initialState, scope, children }: ServiceProviderProps) {
  const parent = useContext(ScopeContext);
  const tokens: ServiceConstructor[] = [];
  const inputs: ServiceInputBinding[] = [];
  const seen = new Set<ServiceConstructor>();
  for (const registration of services) {
    const token = typeof registration === 'function' ? registration : registration?.service;
    if (typeof token !== 'function')
      throw new Error(
        'ServiceProvider services must be service constructors or serviceInputs() bindings.',
      );
    if (seen.has(token)) throw new Error(`Duplicate service registration: ${token.name}`);
    seen.add(token);
    tokens.push(token);
    if (typeof registration !== 'function') inputs.push(registration);
  }
  const [ownership] = useState(() => ({
    scope: scope ?? new ServiceScope(tokens, { parent: parent ?? undefined, initialState, inputs }),
    external: scope !== undefined,
    services: tokens,
    initialState,
    parent,
    suppliedScope: scope,
  }));

  if (
    ownership.parent !== parent ||
    ownership.suppliedScope !== scope ||
    ownership.initialState !== initialState ||
    ownership.services.length !== tokens.length ||
    ownership.services.some((token, index) => token !== tokens[index])
  ) {
    throw new Error(
      'ServiceProvider configuration changed. Use a different React key to replace its scope.',
    );
  }

  useEffect(() => {
    if (ownership.external) {
      ownership.scope.start();
      return;
    }
    return ownership.scope.acquire();
  }, [ownership]);

  return (
    <ScopeContext.Provider value={ownership.scope}>
      {inputs.length > 0 && <InputCommit scope={ownership.scope} inputs={inputs} />}
      {children}
    </ScopeContext.Provider>
  );
}
