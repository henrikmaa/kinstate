'use client';
'use no service tracking';

import { flushSync, type ServiceScope, type ServiceInputBinding } from '@kinstate/core';
import { useEffect, useLayoutEffect, useState } from 'react';

const useInputLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/** Publish only committed snapshots. This component precedes consumer layout effects. */
export function InputCommit({
  scope,
  inputs,
}: {
  scope: ServiceScope;
  inputs: readonly ServiceInputBinding[];
}) {
  const [, refresh] = useState(0);
  useInputLayoutEffect(() => {
    const changed = scope.applyInputs(inputs);
    flushSync();
    // A first consumer may not have subscribed yet. A layout state update also
    // flushes its external-store consistency check before the browser paints.
    if (changed) refresh((version) => version + 1);
    // The refresh belongs to this bridge, not a new provider commit. Reapplying
    // the same snapshot here can loop if service logic reconciles an input.
  }, [scope, inputs]);
  return null;
}
