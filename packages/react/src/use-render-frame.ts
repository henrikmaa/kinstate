'use client';
'use no service tracking';

import { useSyncExternalStore } from 'react';
import { RenderFrame } from './render-frame.js';

/** Generated hook; never invoke from service code. */
export function useRenderFrame(): RenderFrame {
  const frame = new RenderFrame();
  useSyncExternalStore(frame.subscribe, frame.getSnapshot, frame.getServerSnapshot);
  return frame;
}
