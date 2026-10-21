'use client';
import { useEffect, useRef, useState } from 'react';
import { ServiceProvider, useService } from '@kinstate/react';
import { CounterService } from './CounterService';
function Display() {
  const service = useService(CounterService);
  const renders = useRef(0);
  const counter = useRef<HTMLSpanElement>(null);
  renders.current++;
  useEffect(() => {
    if (counter.current) counter.current.textContent = String(renders.current);
  });
  return (
    <section>
      <output data-testid="count">{service.count}</output>
      <p>Doubled: {service.doubled}</p>
      <p>
        Count renders: <span ref={counter} data-testid="count-renders" />
      </p>
      <button onClick={() => service.increment()}>Increment</button>
    </section>
  );
}
function Name() {
  const service = useService(CounterService);
  const renders = useRef(0);
  const counter = useRef<HTMLSpanElement>(null);
  renders.current++;
  useEffect(() => {
    if (counter.current) counter.current.textContent = String(renders.current);
  });
  return (
    <section>
      <h2 data-testid="name">{service.name}</h2>
      <p>
        Name renders: <span ref={counter} data-testid="name-renders" />
      </p>
      <button
        onClick={() => {
          service.name = 'Renamed';
        }}
      >
        Rename
      </button>
    </section>
  );
}
export default function Counter({ count }: { count: number }) {
  const [initialState] = useState(() => [{ service: CounterService, state: { count } }]);
  return (
    <ServiceProvider services={[CounterService]} initialState={initialState}>
      <Display />
      <Name />
    </ServiceProvider>
  );
}
