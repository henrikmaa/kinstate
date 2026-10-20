import { ServiceScope } from '@kinstate/core';
import { CounterService } from './CounterService';
import Counter from './Counter';
// Every invocation owns its scope. Only plain initial data crosses the boundary.
export const dynamic = 'force-dynamic';
export default function Page() {
  const scope = new ServiceScope([CounterService]);
  try {
    scope.get(CounterService).count = 7;
    return <main><h1>Kinstate</h1><p>Ordinary classes. Reactive state.</p><p>The server supplies the initial count. The client owns subsequent changes.</p><Counter count={scope.get(CounterService).count}/></main>;
  } finally { scope.dispose(); }
}
