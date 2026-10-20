# Edit API data without editing the cache

Treat incoming API data as an immutable source and keep an editable draft in the service. The query library owns the source; the service owns editing decisions such as dirty state, reset and conflict warnings.

This example preserves a dirty draft when a same-record refetch arrives. A different entity resets the editor.

```ts
import { observe, Service } from '@kinstate/core';

type Profile = Readonly<{ id: string; name: string; revision: number }>;
class EditorResources {
  stop: (() => void) | undefined;
  seen = false;
  previous: Profile | undefined;
}

export class ProfileEditor extends Service {
  source: Profile | undefined = undefined;
  draftName = '';
  conflict = false;
  private baseline: Profile | undefined = undefined;
  private active = false;
  private readonly resources = new EditorResources();

  get displayedName() {
    return this.active ? this.draftName : (this.source?.name ?? '');
  }
  get dirty() {
    return !!this.baseline && this.draftName !== this.baseline.name;
  }

  onInit() {
    this.active = true;
    this.resources.stop = observe(() => {
      const incoming = this.source;
      if (this.resources.seen && incoming === this.resources.previous) return;
      this.resources.seen = true;
      this.resources.previous = incoming;
      if (incoming?.id !== this.baseline?.id || !this.dirty || incoming?.name === this.draftName) {
        this.accept(incoming);
      } else {
        this.conflict =
          incoming?.revision !== this.baseline?.revision || incoming?.name !== this.baseline?.name;
      }
    });
  }
  onDispose() {
    this.resources.stop?.();
    this.resources.stop = undefined;
    this.active = false;
  }
  editName(name: string) {
    this.draftName = name;
  }
  reset() {
    this.accept(this.source);
  }
  private accept(profile: Profile | undefined) {
    this.baseline = profile;
    this.draftName = profile?.name ?? '';
    this.conflict = false;
  }
}
```

The observer is React-independent and belongs to the activation lifecycle. The pure `displayedName` getter uses the seeded source before activation, so SSR and initial hydration can display the name without starting an observer on the server.

```tsx
import { serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import { ProfileEditor } from './ProfileEditor';

type Profile = Readonly<{ id: string; name: string; revision: number }>;
export function ProfilePage({ profile }: { profile: Profile | undefined }) {
  return (
    <ServiceProvider services={[serviceInputs(ProfileEditor, { source: profile })]}>
      <Fields />
    </ServiceProvider>
  );
}
function Fields() {
  const editor = useService(ProfileEditor);
  return (
    <section>
      <input
        aria-label="Name"
        value={editor.displayedName}
        onChange={(event) => editor.editName(event.target.value)}
      />
      {editor.conflict && <p>New server data arrived. Your draft is preserved.</p>}
      <button onClick={() => editor.reset()}>Reset to server value</button>
    </section>
  );
}
```

## Add saving as an explicit policy

Pass a save command through a writable callback input. Submit a snapshot of the draft and server revision, rather than the borrowed source object. The command's owner updates or invalidates its query cache; Kinstate cannot infer that cache operation from the callback's result.

For production saves, also decide what happens when the user types during a request, switches entities, resets, or receives a refetch. Use an `AbortController` and generation guard to reject stale completions even if abort is ignored. Preserve newer typing when accepting a response, and keep the draft on failure. An optimistic preview should be separate state, so rollback never mutates the source cache.

This page focuses on reconciliation rather than a complete transport. Combine it with [callbacks](callbacks.md) and [async ownership](async-actions.md). The maintained repository `ProfileEditorService` example implements and tests optimistic saves, stale-result rejection, rollback, callback replacement and lifecycle reactivation.
