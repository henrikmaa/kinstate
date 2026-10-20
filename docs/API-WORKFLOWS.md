# API-backed editable forms

External state enters a service through `serviceInputs`; it does not have to come from a particular query library. Keep the query cache authoritative, and give the service a separate draft for edits.

The maintained example is [ProfileEditorService](../packages/examples/vite-react/src/ProfileEditorService.ts). Its tests import that exact implementation in [editor-workflow.test.ts](../packages/tests/editor-workflow.test.ts). These are application policies built with the existing framework API, not a required service base class or additional hook.

## Connect state and commands

```tsx
import { serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import {
  ProfileEditorService,
  type EditableProfile,
  type SaveProfile,
} from './ProfileEditorService';

function ProfilePage() {
  // Application adapters: these can use any fetching/cache/state library.
  const query = useProfileQuery();
  const saveProfile: SaveProfile = useProfileSaveCommand();

  return (
    <ServiceProvider
      services={[
        serviceInputs(ProfileEditorService, {
          source: query.data,
          saveProfile,
        }),
      ]}
    >
      <ProfileForm />
    </ServiceProvider>
  );
}

function ProfileForm() {
  const editor = useService(ProfileEditorService);
  return (
    <section>
      <input
        aria-label="Name"
        value={editor.displayedName}
        onChange={(event) => editor.editName(event.target.value)}
      />
      {editor.conflict && <p>New server data arrived. Your edits are preserved.</p>}
      {editor.error && <p role="alert">{editor.error}</p>}
      <button
        disabled={!editor.canSave}
        onClick={() => {
          void editor.save();
        }}
      >
        {editor.saving ? 'Saving…' : 'Save'}
      </button>
      <button onClick={() => editor.reset()}>Reset to latest server value</button>
      <p>Preview: {editor.preview?.name}</p>
    </section>
  );
}
```

`useProfileQuery` and `useProfileSaveCommand` above are application adapters, not framework exports. The save command receives an immutable `{ id, name, revision }` payload and `{ signal: AbortSignal }`, returns the saved profile, and updates or invalidates the authoritative cache according to the fetching library's conventions. Use the server revision for optimistic concurrency checks if your API supports it. Forward the abort signal when the transport supports it. A cache library may expose its own cancellation method instead; bridge that in the command adapter.

Callbacks remain ordinary values. A callback created by a React hook can close over current application state; the provider replaces that field at commit. The service captures the latest committed callback once when each request begins. Replacing a callback does not retroactively change an in-flight request. Memoizing the adapter is useful when its dependencies are stable, but service input descriptors themselves do not require memoization.

## Editing and reconciliation policy

The service never assigns to `source` or `saveProfile`. A committed source is copied into a small owned editing baseline; `draftName` is independent state.

- Initial data and clean refetches populate the draft.
- A different entity ID resets the draft. Clearing the source clears the editor.
- A same-entity refetch preserves a dirty draft and exposes `conflict`. If the new server value already matches the draft, the draft becomes clean.
- Reset explicitly accepts the latest source and cancels a pending save.
- Saving shows an optimistic preview without modifying the input or query cache. Success accepts the returned baseline. If the user keeps typing while saving, those newer edits are preserved.
- Failure rolls the preview back to the external source, keeps the draft for retry, and exposes an error. `save()` returns `saved`, `failed`, or `ignored`; handled request failures do not become unhandled click-handler rejections.

A successful save can finish before the cache publishes its replacement value. The returned result is an acknowledged editing baseline; `source` remains the last value from the external owner. The command adapter must eventually update or refetch that source. The framework does not infer cache mutations from an arbitrary callback result.

The reconciliation observer compares source snapshots, including ID, name, and revision. Equal snapshots do not reset edits. This example owns one field; extend both the snapshot comparison and draft/conflict policy when adding fields.

## Async work has an owner

Each request has an `AbortController` and a generation number. Starting a newer request invalidates the older one. A changed source also cancels a pending request, so a refetch or entity switch cannot be overwritten by a late response. The generation and source checks still reject stale completions if the transport ignores cancellation.

`onInit` installs one reconciliation observer. `onDispose` removes it, aborts work, and invalidates the generation. React Activity can deactivate and reactivate a provider while retaining its service instance; the resource lifecycle restarts without duplicating observers or accepting a response from the previous activation. Drafts remain available until reconciliation or an explicit reset changes them.

This cancellation policy belongs to the application. The reactive engine does not cancel every async service method automatically: background jobs, persistence, and payments may have different ownership requirements. Cancellation also cannot undo a server operation that already committed. Use idempotency keys or version checks where your API needs those guarantees.

## Commit, Suspense, and SSR boundaries

Inputs flow one way from committed React state into a scoped service. The provider seeds an owned scope for its initial render and applies later inputs during commit. A suspended or abandoned update does not publish its speculative values into the existing service. Do not use an externally owned scope as a render-time synchronization side channel.

This is not an atomic transaction spanning a query store, React state, and the service. A query result can have advanced in its own store while the service still holds the previous committed input. If a screen needs loading/Suspense behavior to follow that query, keep suspension and request orchestration in the source-owning React layer. The service does not throw a query promise automatically.

The editor's observer starts at lifecycle initialization after client commit. Its pure displayedName getter reads the seeded source before activation, so SSR and the first client render display the initial name without starting resources. Activation switches it to the owned draft; later edits and reconciliation use that draft. Server requests must use separate scopes and must not start client resources implicitly.
