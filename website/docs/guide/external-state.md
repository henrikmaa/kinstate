# Bring state from any React library

A query cache, context, local hook or another store can remain the source of truth. `serviceInputs` passes its ordinary values into a service. The service receives no dependency on the originating library.

```tsx
import { useState } from 'react';
import { Service, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

type Product = Readonly<{ id: string; name: string }>;

class CatalogService extends Service {
  products: readonly Product[] = [];
  loading = false;
  search = '';

  setSearch(value: string) {
    this.search = value;
  }

  get matchingNames() {
    const query = this.search.toLowerCase();
    return this.products
      .filter((product) => product.name.toLowerCase().includes(query))
      .map((product) => product.name);
  }
}

function Catalog() {
  const catalog = useService(CatalogService);
  return (
    <section>
      <input
        aria-label="Filter"
        value={catalog.search}
        onChange={(event) => {
          catalog.setSearch(event.target.value);
        }}
      />
      {catalog.loading ? <p>Loading…</p> : <p>{catalog.matchingNames.join(', ')}</p>}
    </section>
  );
}

export function CatalogPage() {
  const [products, setProducts] = useState<readonly Product[]>([{ id: 'book', name: 'Book' }]);
  return (
    <>
      <button
        onClick={() =>
          setProducts((previous) => [
            ...previous,
            { id: String(previous.length), name: 'New product' },
          ])
        }
      >
        Publish a new source snapshot
      </button>
      <ServiceProvider services={[serviceInputs(CatalogService, { products, loading: false })]}>
        <Catalog />
      </ServiceProvider>
    </>
  );
}
```

The source can instead be `query.data`, a context value, or a selector result from an existing store. Call that library's hooks in the owning React component, then bind the returned values. Input descriptor objects may be created inline; they do not require `useMemo`.

## Ownership and identity

Plain objects and arrays supplied as inputs become service-owned copies. A service method can edit that state without changing the query cache or React state that supplied it. React consumers still read the same fields through `useService()` and receive stable read-only views; commands remain ordinary service methods.

Kinstate compares each incoming field with its last published source using `Object.is`. An unchanged source reference preserves local edits, including across unrelated provider renders. A replacement source reference publishes a new copy and replaces the bound field. Mutating the original source in place does not update the service: publish a replacement according to the source library's contract. Inline input descriptors do not themselves cause copies when their field values are unchanged.

Service-owned `search` remains independent when products change. To save edits back to the source, call an owner-provided [command callback](callbacks.md). For workflows that must retain unsaved edits across refetches, keep a separate [draft](forms-and-drafts.md).

## Commit timing

A newly owned provider seeds inputs before its first consumer render. Later inputs publish during React commit. Suspended or abandoned renders cannot overwrite the live service with speculative values.

This is not an atomic transaction across React, a query cache and Kinstate. Let the source hook suspend before it supplies bindings. Do not suspend a consumer waiting for an input change whose publication requires that same provider commit.

Declare writable fields with runtime initializers. Omitted keys retain previous values; explicit `undefined` clears optional fields. Inputs take precedence over overlapping initial state. An externally owned scope must be preseeded explicitly for correct first-render and SSR values. These boundaries also apply when the external value comes from a different React state library.

Already-reactive Kinstate objects supplied as inputs retain their canonical identity and existing deep reactivity. Dependency injection is usually clearer for sharing state between services.
