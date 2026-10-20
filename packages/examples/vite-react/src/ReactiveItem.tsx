import { useRef, type ReactNode } from 'react';

/** Compiled props consumers keep ordinary React signatures; no service hook is needed here. */
export function ReactiveItem({ item }: { item: { label: string } }) {
  const renders = useRef(0);
  renders.current++;
  return (
    <div>
      <output data-testid="prop-item">{item.label}</output>
      <small data-testid="prop-child-renders">{renders.current} renders</small>
    </div>
  );
}

export function RenderContent({ children }: { children: () => ReactNode }) {
  return <output data-testid="render-content">{children()}</output>;
}
