# Pass commands into a service

Services sometimes need to navigate, save through a query library, notify a parent, or use a function returned by another hook. Bind an ordinary callback field with `serviceInputs`.

```tsx
import { useCallback, useState } from 'react';
import { Service, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

class RenameService extends Service {
  draft = '';
  saving = false;
  error: string | undefined = undefined;
  onSave: ((name: string) => Promise<void>) | undefined = undefined;

  setDraft(value: string) {
    this.draft = value;
  }

  async save() {
    const command = this.onSave;
    if (!command || this.saving) return;
    const submitted = this.draft;
    this.saving = true;
    this.error = undefined;
    try {
      await command(submitted);
    } catch (error) {
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this.saving = false;
    }
  }
}

function RenameForm() {
  const editor = useService(RenameService);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void editor.save();
      }}
    >
      <input
        aria-label="Name"
        value={editor.draft}
        onChange={(event) => {
          editor.setDraft(event.target.value);
        }}
      />
      <button disabled={editor.saving}>Save</button>
      {editor.error && <p role="alert">{editor.error}</p>}
    </form>
  );
}

export function RenamePage({ recordId }: { recordId: string }) {
  const [message, setMessage] = useState('');
  const onSave = useCallback(
    async (name: string) => {
      const response = await fetch(`/api/records/${encodeURIComponent(recordId)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Save failed');
      setMessage(`Saved ${recordId}`);
    },
    [recordId],
  );

  return (
    <ServiceProvider key={recordId} services={[serviceInputs(RenameService, { onSave })]}>
      <RenameForm />
      <p>{message}</p>
    </ServiceProvider>
  );
}
```

The service captures the latest committed command when a save begins. Changing `recordId` remounts this editor scope, while the callback itself follows ordinary React closure rules. This compact example handles errors, but does not cancel an in-flight transport on unmount; use the ownership and generation pattern in [async actions](async-actions.md) for requests that must stop publishing after disposal.

## Callback behavior stays ordinary

Inside a service, input bindings preserve the supplied callback and its identity. `this.callback()` uses the service as its receiver; use an arrow or an already bound function when an external API needs another receiver. Arguments and errors retain ordinary JavaScript behavior.

React consumers receive stable callback wrappers rather than the original supplied functions. Object results are protected by the read-only view, including values resolved by returned promises; promise wrappers are stable for the same original promise. Compare consumer wrappers with consumer wrappers, rather than with the original hook callback or promise.

A detached callback is a snapshot of that function. A stable service method that reads `this.onSave` obtains the current committed callback on each invocation. `useCallback` is optional for binding; use it when the source's identity contract benefits from it.

Declare callbacks as own writable fields initialized to `undefined` or a default function. Prototype methods, getters and lifecycle hooks cannot be input targets. Omission preserves a previous callback; explicit `undefined` clears an optional one.

Do not invoke commands during rendering or pass React Hook functions themselves as service commands. A stable callback hiding mutable external state does not invalidate a computed getter: bind that state separately when derivations depend on it. In Next.js, create ordinary callback bindings inside the client boundary; arbitrary functions are not JSON hydration data.
