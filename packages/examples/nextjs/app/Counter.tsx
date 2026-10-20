'use client';
import { useState } from 'react';
import { ServiceProvider, useService } from '@kinstate/react';
import { CounterService } from './CounterService';
function Display() {
  const service = useService(CounterService);
  return <section><h2>{service.name}</h2><output data-testid="count">{service.count}</output><p>Doubled: {service.doubled}</p><button onClick={() => service.increment()}>Increment</button></section>;
}
export default function Counter({ count }: { count: number }) {
  const [initialState] = useState(() => [{ service: CounterService, state: { count } }]);
  return <ServiceProvider services={[CounterService]} initialState={initialState}><Display/></ServiceProvider>;
}
