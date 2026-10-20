'use client';

import type { ServiceScope } from '@kinstate/core';
import { createContext } from 'react';

/** Shared resolution context; importing it never creates a service scope. */
export const ScopeContext = createContext<ServiceScope | null>(null);
