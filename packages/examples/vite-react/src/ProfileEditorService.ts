import { Service, observe } from '@kinstate/core';

export interface EditableProfile {
  readonly id: string;
  readonly name: string;
  readonly revision: number;
}
export type SaveProfile = (
  profile: Readonly<EditableProfile>,
  options: { signal: AbortSignal },
) => Promise<Readonly<EditableProfile>>;
export type SaveOutcome =
  | { status: 'saved'; profile: Readonly<EditableProfile> }
  | { status: 'failed'; error: unknown }
  | { status: 'ignored' };

// Resource bookkeeping deliberately stays nonobservable. All UI state lives on
// the service; this private class owns only cancellation and source identity.
class EditorResources {
  stop: (() => void) | undefined;
  controller: AbortController | undefined;
  generation = 0;
  seenInput = false;
  lastInput: Readonly<EditableProfile> | undefined;
}
function snapshot(profile: Readonly<EditableProfile> | undefined) {
  return profile === undefined
    ? undefined
    : Object.freeze({ id: profile.id, name: profile.name, revision: profile.revision });
}
function sameProfile(
  a: Readonly<EditableProfile> | undefined,
  b: Readonly<EditableProfile> | undefined,
) {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.id === b.id &&
      a.name === b.name &&
      Object.is(a.revision, b.revision))
  );
}

/** Application recipe, not an additional framework base class or input protocol. */
export class ProfileEditorService extends Service {
  // Externally owned inputs. Service methods never assign to these fields.
  source: Readonly<EditableProfile> | undefined = undefined;
  saveProfile: SaveProfile | undefined = undefined;

  draftName = '';
  saving = false;
  conflict = false;
  error: string | undefined = undefined;
  optimisticProfile: Readonly<EditableProfile> | undefined = undefined;
  private baseline: Readonly<EditableProfile> | undefined = undefined;
  private active = false;
  private readonly resources = new EditorResources();

  get displayedName() {
    return this.active ? this.draftName : (this.source?.name ?? '');
  }

  get dirty() {
    return this.baseline !== undefined && this.draftName !== this.baseline.name;
  }
  get preview() {
    return this.optimisticProfile ?? this.source;
  }
  get canSave() {
    return (
      this.active &&
      this.source !== undefined &&
      this.saveProfile !== undefined &&
      !this.saving &&
      this.dirty
    );
  }

  onInit() {
    if (this.active) return;
    this.active = true;
    this.resources.stop = observe(() => {
      const incoming = snapshot(this.source);
      if (this.resources.seenInput && sameProfile(incoming, this.resources.lastInput)) return;
      this.resources.seenInput = true;
      this.resources.lastInput = incoming;
      this.reconcile(incoming);
    });
  }

  onDispose() {
    this.resources.stop?.();
    this.resources.stop = undefined;
    this.active = false;
    this.cancelPending();
  }

  editName(name: string) {
    this.draftName = name;
    this.error = undefined;
  }

  /** Discard edits and accept the latest external value, including a cleared input. */
  reset() {
    this.cancelPending();
    this.accept(snapshot(this.source));
  }

  private accept(profile: Readonly<EditableProfile> | undefined) {
    this.baseline = profile;
    this.draftName = profile?.name ?? '';
    this.conflict = false;
    this.error = undefined;
  }

  private reconcile(incoming: Readonly<EditableProfile> | undefined) {
    // Source changes invalidate the request even when the transport ignores abort.
    this.cancelPending();
    if (incoming?.id !== this.baseline?.id || !this.dirty || incoming?.name === this.draftName) {
      this.accept(incoming);
      return;
    }
    // Keep the original editing baseline; reset explicitly accepts the new source.
    this.conflict = !sameProfile(incoming, this.baseline);
  }

  private cancelPending() {
    this.resources.generation++;
    this.resources.controller?.abort();
    this.resources.controller = undefined;
    this.saving = false;
    this.optimisticProfile = undefined;
  }

  async save(): Promise<SaveOutcome> {
    if (!this.active) return { status: 'ignored' };
    const callback = this.saveProfile; // Capture the latest committed command once per request.
    const inputAtStart = snapshot(this.source);
    if (!callback || !inputAtStart) {
      const error = new Error('A profile and save callback are required.');
      this.error = error.message;
      return { status: 'failed', error };
    }
    this.cancelPending();
    const generation = this.resources.generation;
    const controller = new AbortController();
    this.resources.controller = controller;
    const submitted = Object.freeze({
      ...inputAtStart,
      name: this.draftName,
      revision: this.baseline?.revision ?? inputAtStart.revision,
    });
    this.saving = true;
    this.error = undefined;
    this.optimisticProfile = submitted;
    const current = () =>
      this.active &&
      generation === this.resources.generation &&
      !controller.signal.aborted &&
      sameProfile(inputAtStart, snapshot(this.source));
    try {
      const response = snapshot(await callback(submitted, { signal: controller.signal }))!;
      if (!current()) return { status: 'ignored' };
      if (response.id !== submitted.id)
        throw new Error('The save response belongs to another profile.');
      // A user may keep typing while saving. Only normalize the submitted draft
      // when it has not changed since this request began.
      if (this.draftName === submitted.name) this.draftName = response.name;
      this.baseline = response;
      this.conflict = false;
      return { status: 'saved', profile: response };
    } catch (error) {
      if (!current()) return { status: 'ignored' };
      this.error = error instanceof Error ? error.message : String(error);
      return { status: 'failed', error };
    } finally {
      if (current()) {
        this.resources.controller = undefined;
        this.saving = false;
        this.optimisticProfile = undefined;
      }
    }
  }
}
