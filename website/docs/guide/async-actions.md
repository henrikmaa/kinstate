# Async actions

Async methods remain ordinary TypeScript methods. Assignments before and after `await` update observable fields. A React event can invoke the method without putting React APIs in the class.

The application must decide which requests may publish results. Cancellation alone is insufficient when a transport ignores an abort signal or a response has already arrived. This search service combines cancellation, a generation check and lifecycle ownership:

```ts
import { Service } from '@kinstate/core';

class SearchResources {
  generation = 0;
  controller: AbortController | undefined;
}

export class SearchService extends Service {
  results: string[] = [];
  loading = false;
  error: string | undefined = undefined;
  private active = false;
  private readonly requests = new SearchResources();

  onInit() {
    this.active = true;
  }
  onDispose() {
    this.active = false;
    this.requests.generation++;
    this.requests.controller?.abort();
    this.requests.controller = undefined;
    this.loading = false;
  }

  async search(query: string) {
    if (!this.active) return;
    const generation = ++this.requests.generation;
    this.requests.controller?.abort();
    const controller = new AbortController();
    this.requests.controller = controller;
    this.loading = true;
    this.error = undefined;
    const current = () =>
      this.active && generation === this.requests.generation && !controller.signal.aborted;

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Search failed');
      const results = (await response.json()) as string[];
      if (current()) this.results = results;
    } catch (error) {
      if (current()) this.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (current()) {
        this.loading = false;
        this.requests.controller = undefined;
      }
    }
  }
}
```

`SearchResources` is an intentionally opaque nested class for resource bookkeeping. Display state remains on the reactive service. The example assumes the API returns a string array; validate untrusted payloads according to your application's contract.

```tsx
import { useService } from '@kinstate/react';
import { SearchService } from './SearchService';

export function SearchBox() {
  const search = useService(SearchService);
  return (
    <input
      aria-label="Search"
      onChange={(event) => {
        void search.search(event.target.value);
      }}
    />
  );
}
```

Provide the service above this component. Initialization happens after commit; server rendering starts no request. Lifecycle hooks themselves are synchronous. Launch an async operation deliberately from `onInit` if required, and own its cleanup in `onDispose`.

Observation and batching are synchronous. Reads after `await` are not added to an earlier computation, and `batch(async () => ...)` does not create one transaction spanning suspension. For query-cache ownership or hook-provided mutation commands, use [external inputs](external-state.md) and [callbacks](callbacks.md). Kinstate does not automatically cancel arbitrary payments, persistence or background work.
