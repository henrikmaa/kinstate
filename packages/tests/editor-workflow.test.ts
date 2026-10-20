import { describe, expect, it } from 'vitest';
import { ServiceScope, flushSync, serviceInputs } from '@kinstate/core';
import {
  ProfileEditorService,
  type EditableProfile,
  type SaveProfile,
} from '../examples/vite-react/src/ProfileEditorService.js';

const profile = (name = 'Ada', revision = 1, id = 'a'): EditableProfile => ({ id, name, revision });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(saveProfile?: SaveProfile) {
  const scope = new ServiceScope([ProfileEditorService], {
    inputs: [serviceInputs(ProfileEditorService, { source: profile(), saveProfile })],
  });
  const editor = scope.get(ProfileEditorService);
  expect(editor.displayedName).toBe('Ada');
  expect(editor.canSave).toBe(false);
  scope.start();
  expect(editor.displayedName).toBe('Ada');
  const publish = (source: EditableProfile | undefined) => {
    scope.applyInputs([serviceInputs(ProfileEditorService, { source })]);
    flushSync();
  };
  return { scope, editor, publish };
}

describe('API-backed editable service recipe', () => {
  it('seeds initial state, refreshes clean drafts, and retains dirty drafts with explicit conflict/reset', () => {
    const { scope, editor, publish } = fixture();
    try {
      expect(editor.draftName).toBe('Ada');
      expect(editor.dirty).toBe(false);
      publish(profile('Grace', 2));
      expect(editor.draftName).toBe('Grace');
      editor.editName('Local');
      publish(profile('Server', 3));
      expect(editor.draftName).toBe('Local');
      expect(editor.source?.name).toBe('Server');
      expect(editor.conflict).toBe(true);
      editor.reset();
      expect(editor.draftName).toBe('Server');
      expect(editor.conflict).toBe(false);
      expect(editor.dirty).toBe(false);
    } finally {
      scope.dispose();
    }
  });

  it('resets on entity switches and cleared inputs, and accepts matching refetches', () => {
    const { scope, editor, publish } = fixture();
    try {
      editor.editName('Local');
      publish(profile('Different', 1, 'b'));
      expect(editor.draftName).toBe('Different');
      expect(editor.dirty).toBe(false);
      editor.editName('Matching');
      publish(profile('Matching', 2, 'b'));
      expect(editor.dirty).toBe(false);
      expect(editor.conflict).toBe(false);
      publish(undefined);
      expect(editor.draftName).toBe('');
      expect(editor.canSave).toBe(false);
    } finally {
      scope.dispose();
    }
  });

  it('reads the latest callback at request start without mutating externally owned source', async () => {
    let oldCalls = 0;
    const old: SaveProfile = async (value) => {
      oldCalls++;
      return value;
    };
    const { scope, editor } = fixture(old);
    try {
      const next: SaveProfile = async (value) => ({
        ...value,
        name: value.name.toUpperCase(),
        revision: value.revision + 1,
      });
      scope.applyInputs([serviceInputs(ProfileEditorService, { saveProfile: next })]);
      expect(editor.saveProfile).toBe(next);
      editor.editName('grace');
      expect((await editor.save()).status).toBe('saved');
      expect(editor.draftName).toBe('GRACE');
      expect(editor.source?.name).toBe('Ada');
      expect(editor.dirty).toBe(false);
      expect(oldCalls).toBe(0);
    } finally {
      scope.dispose();
    }
  });

  it('shows optimistic preview, rolls it back on error, and keeps edits for retry', async () => {
    const request = deferred<EditableProfile>();
    const { scope, editor } = fixture(() => request.promise);
    try {
      editor.editName('Optimistic');
      const saving = editor.save();
      expect(editor.saving).toBe(true);
      expect(editor.preview?.name).toBe('Optimistic');
      request.reject(new Error('Conflict from API'));
      expect((await saving).status).toBe('failed');
      expect(editor.error).toBe('Conflict from API');
      expect(editor.preview?.name).toBe('Ada');
      expect(editor.draftName).toBe('Optimistic');
      expect(editor.dirty).toBe(true);
      expect(editor.saving).toBe(false);
    } finally {
      scope.dispose();
    }
  });

  it('ignores out-of-order requests even when a transport ignores abort', async () => {
    const requests: ReturnType<typeof deferred<EditableProfile>>[] = [];
    const signals: AbortSignal[] = [];
    const { scope, editor } = fixture((_value, { signal }) => {
      const request = deferred<EditableProfile>();
      requests.push(request);
      signals.push(signal);
      return request.promise;
    });
    try {
      editor.editName('First');
      const first = editor.save();
      editor.editName('Second');
      const second = editor.save();
      expect(signals[0]!.aborted).toBe(true);
      requests[1]!.resolve(profile('Second', 3));
      expect((await second).status).toBe('saved');
      requests[0]!.resolve(profile('First', 2));
      expect((await first).status).toBe('ignored');
      expect(editor.draftName).toBe('Second');
      expect(editor.error).toBeUndefined();
    } finally {
      scope.dispose();
    }
  });

  it('preserves typing during a save and invalidates pending responses on source changes', async () => {
    const requests: ReturnType<typeof deferred<EditableProfile>>[] = [];
    const { scope, editor, publish } = fixture(() => {
      const request = deferred<EditableProfile>();
      requests.push(request);
      return request.promise;
    });
    try {
      editor.editName('Submitted');
      const first = editor.save();
      editor.editName('New typing');
      requests[0]!.resolve(profile('SUBMITTED', 2));
      expect((await first).status).toBe('saved');
      expect(editor.draftName).toBe('New typing');
      expect(editor.dirty).toBe(true);
      const second = editor.save();
      publish(profile('Another entity', 1, 'b'));
      requests[1]!.reject(new Error('Late failure'));
      expect((await second).status).toBe('ignored');
      expect(editor.draftName).toBe('Another entity');
      expect(editor.error).toBeUndefined();
    } finally {
      scope.dispose();
    }
  });

  it('stops reconciliation, aborts in-flight work, and restarts safely after lifecycle deactivation', async () => {
    const request = deferred<EditableProfile>();
    let signal!: AbortSignal;
    const { scope, editor, publish } = fixture((_value, options) => {
      signal = options.signal;
      return request.promise;
    });
    editor.editName('Pending');
    const saving = editor.save();
    editor.onDispose();
    editor.onDispose();
    expect(signal.aborted).toBe(true);
    publish(profile('Hidden refresh', 2));
    expect(editor.draftName).toBe('Pending');
    request.resolve(profile('Late result', 3));
    expect((await saving).status).toBe('ignored');
    expect(editor.draftName).toBe('Pending');
    editor.onInit();
    editor.onInit();
    expect(editor.source?.name).toBe('Hidden refresh');
    expect(editor.draftName).toBe('Pending');
    expect(editor.conflict).toBe(true);
    editor.reset();
    expect(editor.draftName).toBe('Hidden refresh');
    scope.dispose();
  });

  it('does not accept a same-tick stale response before the input observer flushes', async () => {
    const request = deferred<EditableProfile>();
    const { scope, editor } = fixture(() => request.promise);
    try {
      editor.editName('Pending');
      const saving = editor.save();
      scope.applyInputs([
        serviceInputs(ProfileEditorService, { source: profile('New source', 2) }),
      ]);
      request.resolve(profile('Stale response', 3));
      expect((await saving).status).toBe('ignored');
      flushSync();
      expect(editor.draftName).toBe('Pending');
      expect(editor.conflict).toBe(true);
    } finally {
      scope.dispose();
    }
  });

  it('retains the instance across real scope lease deactivation and ignores prior-activation results', async () => {
    const request = deferred<EditableProfile>();
    const { scope, editor, publish } = fixture(() => request.promise);
    try {
      const release = scope.acquire();
      editor.editName('Local');
      const saving = editor.save();
      release();
      await Promise.resolve();
      publish(profile('Refetched while hidden', 2));
      const releaseAgain = scope.acquire();
      expect(scope.get(ProfileEditorService)).toBe(editor);
      expect(editor.draftName).toBe('Local');
      expect(editor.conflict).toBe(true);
      request.resolve(profile('Prior activation response', 3));
      expect((await saving).status).toBe('ignored');
      expect(editor.draftName).toBe('Local');
      editor.reset();
      expect(editor.draftName).toBe('Refetched while hidden');
      releaseAgain();
      await Promise.resolve();
    } finally {
      scope.dispose();
    }
  });
});
