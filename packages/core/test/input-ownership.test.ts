import { expect, it } from 'vitest';
import {
  Service,
  ServiceScope,
  serviceInputs,
  dependencies,
  observe,
  flushSync,
} from '../src/index.js';

class Editor extends Service {
  document = { title: '', rows: [{ value: 0 }] };
  onSave = (_title: string) => {};
  rename(title: string) {
    this.document.title = title;
  }
}

it('isolates hydration and input payloads between independent scopes', () => {
  const source = { title: 'API', rows: [{ value: 1 }] };
  const initial = [{ service: Editor, state: { document: source } }];
  const a = new ServiceScope([Editor], { initialState: initial });
  const b = new ServiceScope([Editor], { initialState: initial });
  a.get(Editor).rename('local');
  expect(b.get(Editor).document.title).toBe('API');
  expect(source.title).toBe('API');
  source.rows[0]!.value = 2;
  expect(a.get(Editor).document.rows[0]!.value).toBe(1);
  expect(b.get(Editor).document.rows[0]!.value).toBe(1);
  a.dispose();
  b.dispose();
});

it('keeps service edits across equal source publications and observes nested edits', () => {
  const source = { title: 'API', rows: [{ value: 1 }] };
  const scope = new ServiceScope([Editor], {
    inputs: [serviceInputs(Editor, { document: source })],
  });
  const service = scope.get(Editor);
  const seen: string[] = [];
  const stop = observe(() => {
    seen.push(service.document.title);
  });
  const original = service.document;
  service.rename('draft');
  flushSync();
  expect(scope.applyInputs([serviceInputs(Editor, { document: source })])).toBe(false);
  expect(service.document).toBe(original);
  expect(service.document.title).toBe('draft');
  expect(source.title).toBe('API');
  expect(
    scope.applyInputs([serviceInputs(Editor, { document: { ...source, title: 'refetched' } })]),
  ).toBe(true);
  flushSync();
  expect(service.document.title).toBe('refetched');
  expect(seen).toEqual(['API', 'draft', 'refetched']);
  stop();
  scope.dispose();
});

it('shares canonical injected state and retains callback identities', () => {
  class Dependent extends Service {
    static inject = dependencies(Editor);
    constructor(readonly editor: Editor) {
      super();
    }
    rename() {
      this.editor.rename('shared');
    }
  }
  const callback = (_title: string) => {};
  const scope = new ServiceScope([Editor, Dependent], {
    inputs: [serviceInputs(Editor, { onSave: callback })],
  });
  const service = scope.get(Editor);
  expect(scope.get(Dependent).editor).toBe(service);
  expect(service.onSave).toBe(callback);
  scope.get(Dependent).rename();
  expect(service.document.title).toBe('shared');
  scope.dispose();
});

it('prepares all payloads before publishing any fields or updating source identities', () => {
  class Other extends Editor {}
  const scope = new ServiceScope([Editor, Other]);
  const a = scope.get(Editor);
  const b = scope.get(Other);
  const valid = { title: 'next', rows: [{ value: 2 }] };
  const error = new Error('payload reflection failed');
  const invalid = new Proxy(
    { title: 'broken', rows: [{ value: 3 }] },
    {
      ownKeys() {
        throw error;
      },
    },
  );
  expect(() =>
    scope.applyInputs([
      serviceInputs(Editor, { document: valid }),
      serviceInputs(Other, { document: invalid }),
    ]),
  ).toThrow(error);
  expect(a.document.title).toBe('');
  expect(b.document.title).toBe('');
  // A failed preparation must not mark the good source as already published.
  expect(scope.applyInputs([serviceInputs(Editor, { document: valid })])).toBe(true);
  expect(a.document.title).toBe('next');
  scope.dispose();
});

it('preserves shared references across fields of one input or hydration payload', () => {
  class Shared extends Service {
    a = { value: 0 };
    b = { value: 0 };
  }
  const shared = { value: 1 };
  const sources = { a: shared, b: shared };
  const hydrated = new ServiceScope([Shared], {
    initialState: [{ service: Shared, state: sources }],
  });
  const bound = new ServiceScope([Shared], { inputs: [serviceInputs(Shared, sources)] });
  for (const scope of [hydrated, bound]) {
    const value = scope.get(Shared);
    expect(value.a).toBe(value.b);
    expect(value.a).not.toBe(shared);
  }
  expect(hydrated.get(Shared).a).not.toBe(bound.get(Shared).a);
  hydrated.dispose();
  bound.dispose();
});
