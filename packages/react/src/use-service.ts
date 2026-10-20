'use client';
'use no service tracking';

import type { Service, ServiceConstructor, ValidInjection } from '@kinstate/core';
import { useContext, useEffect } from 'react';
import { ScopeContext } from './context.js';
import type { RenderFrame } from './render-frame.js';

/** Consume a service. The compiler supplies the private render-frame argument. */
export function useService<C extends ServiceConstructor>(
  token: C & ValidInjection<C>,
): InstanceType<C>;
export function useService<T extends Service>(token: ServiceConstructor<T>, frame: RenderFrame): T;
export function useService<T extends Service>(
  token: ServiceConstructor<T>,
  frame?: RenderFrame,
): T {
  const scope = useContext(ScopeContext);
  useEffect(() => {
    if (scope) scope.activate(token);
  }, [scope, token]);
  if (!frame) {
    throw new Error('useService requires @kinstate/compiler. Install its Vite or Babel plugin.');
  }
  if (!scope) throw new Error(`useService(${token.name}) requires a ServiceProvider.`);
  return scope.get(token, { deferInitialization: true });
}
