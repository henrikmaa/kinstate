'use client';
'use no service tracking';

// Compiler/runtime protocol. Keep this entry point aligned with generated imports.
export { RenderFrame } from './render-frame.js';
export { useRenderFrame } from './use-render-frame.js';

export { markReactiveComponent, markReactiveWrapper } from './component-tracking.js';

export { useServiceMemo } from './use-service-memo.js';
