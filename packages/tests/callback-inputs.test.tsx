import React, { StrictMode, Suspense, startTransition, useCallback, useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Service, ServiceScope, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

class Editor extends Service {
  draft = 'Ada';
  onSave: ((name: string) => Promise<string>) | undefined = undefined;
  get disabled() {
    return this.onSave === undefined;
  }
  save() {
    return this.onSave?.(this.draft);
  }
}

it('uses the latest committed callback closure from an arbitrary React hook', async () => {
  const scope = new ServiceScope([Editor]);
  const editor = scope.get(Editor);
  let supplied!: (name: string) => Promise<string>;
  let calls = 0;
  function Source() {
    const [revision, setRevision] = useState(0);
    const callback = useCallback(
      async (name: string) => {
        calls++;
        return `${name}:${revision}`;
      },
      [revision],
    );
    supplied = callback;
    return (
      <>
        <button onClick={() => setRevision((value) => value + 1)}>new callback</button>
        <ServiceProvider scope={scope} services={[serviceInputs(Editor, { onSave: callback })]} />
      </>
    );
  }
  const view = render(<Source />);
  expect(calls).toBe(0);
  expect(editor.onSave).toBe(supplied);
  const save = editor.save;
  await expect(save()).resolves.toBe('Ada:0');
  await act(async () => {
    fireEvent.click(screen.getByText('new callback'));
  });
  expect(calls).toBe(1);
  expect(editor.onSave).toBe(supplied);
  expect(editor.save).toBe(save);
  await expect(save()).resolves.toBe('Ada:1');
  view.unmount();
  scope.dispose();
});

it('preserves callback identity, receiver independence, promise results, and errors', async () => {
  const scope = new ServiceScope([Editor]);
  const editor = scope.get(Editor);
  let receiver: unknown = 'not called';
  const promise = Promise.resolve('saved');
  function callback(this: unknown, _name: string) {
    receiver = this;
    return promise;
  }
  const view = render(
    <ServiceProvider scope={scope} services={[serviceInputs(Editor, { onSave: callback })]} />,
  );
  expect(receiver).toBe('not called');
  expect(editor.onSave).toBe(callback);
  const detached = editor.onSave!;
  expect(detached('Ada')).toBe(promise);
  expect(receiver).toBeUndefined();
  expect(editor.save()).toBe(promise);
  await expect(editor.save()).resolves.toBe('saved');
  const failure = new Error('API rejected save');
  const rejecting = async (_name: string): Promise<string> => {
    throw failure;
  };
  view.rerender(
    <ServiceProvider scope={scope} services={[serviceInputs(Editor, { onSave: rejecting })]} />,
  );
  await expect(editor.save()).rejects.toBe(failure);
  const throwing = (_name: string): Promise<string> => {
    throw failure;
  };
  view.rerender(
    <ServiceProvider scope={scope} services={[serviceInputs(Editor, { onSave: throwing })]} />,
  );
  expect(() => editor.save()).toThrow(failure);
  view.unmount();
  scope.dispose();
});

it('notifies direct callback consumers only for identity changes and keeps unrelated consumers quiet', () => {
  const renders = { callback: 0, draft: 0 };
  const first = async (name: string) => name;
  const second = async (name: string) => name;
  const observedCallbacks: Array<Editor['onSave']> = [];
  function CallbackDisplay() {
    const editor = useService(Editor);
    renders.callback++;
    return (
      <button
        onClick={() => {
          void editor.onSave?.('Ada');
        }}
      >
        save
      </button>
    );
  }
  // Event reads deliberately do not subscribe; use an explicit render-time read below.
  function CallbackIdentity() {
    const editor = useService(Editor);
    renders.callback++;
    observedCallbacks.push(editor.onSave);
    return <span>{editor.onSave ? 'available' : 'missing'}</span>;
  }
  function DraftDisplay() {
    const editor = useService(Editor);
    renders.draft++;
    return <span>{editor.draft}</span>;
  }
  const children = (
    <>
      <CallbackIdentity />
      <DraftDisplay />
      <CallbackDisplay />
    </>
  );
  const view = render(
    <ServiceProvider services={[serviceInputs(Editor, { onSave: first })]}>
      {children}
    </ServiceProvider>,
  );
  const baseline = { ...renders };
  const initialCallback = observedCallbacks[0];
  expect(initialCallback).toBeTypeOf('function');
  view.rerender(
    <ServiceProvider services={[serviceInputs(Editor, { onSave: first })]}>
      {children}
    </ServiceProvider>,
  );
  expect(renders).toEqual(baseline);
  expect(observedCallbacks).toEqual([initialCallback]);
  view.rerender(
    <ServiceProvider services={[serviceInputs(Editor, { onSave: second })]}>
      {children}
    </ServiceProvider>,
  );
  expect(screen.getByText('available')).toBeTruthy();
  expect(observedCallbacks).toHaveLength(2);
  expect(observedCallbacks[1]).not.toBe(initialCallback);
  expect(renders.callback - baseline.callback).toBe(1);
  expect(renders.draft).toBe(baseline.draft);
});

it('clears optional callbacks and invalidates computed availability without executing callbacks', () => {
  let calls = 0;
  const callback = async (name: string) => {
    calls++;
    return name;
  };
  function Display() {
    const editor = useService(Editor);
    return <span>{editor.disabled ? 'disabled' : 'enabled'}</span>;
  }
  const child = <Display />;
  const view = render(
    <ServiceProvider services={[serviceInputs(Editor, { onSave: callback })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('enabled')).toBeTruthy();
  view.rerender(
    <ServiceProvider services={[serviceInputs(Editor, { onSave: undefined })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('disabled')).toBeTruthy();
  expect(calls).toBe(0);
});

it('makes initial callbacks available to onInit exactly once under Strict Mode', async () => {
  const calls: string[] = [];
  class Resource extends Editor {
    onInit() {
      void this.save();
    }
  }
  function Display() {
    const editor = useService(Resource);
    return <span>{editor.draft}</span>;
  }
  const callback = async (name: string) => {
    calls.push(name);
    return name;
  };
  render(
    <StrictMode>
      <ServiceProvider services={[serviceInputs(Resource, { onSave: callback })]}>
        <Display />
      </ServiceProvider>
    </StrictMode>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(calls).toEqual(['Ada']);
});

it('does not publish callbacks from suspended and abandoned renders', async () => {
  const scope = new ServiceScope([Editor]);
  const editor = scope.get(Editor);
  const first = async (name: string) => `${name}:first`;
  const pendingCallback = async (name: string) => `${name}:pending`;
  const final = async (name: string) => `${name}:final`;
  let release!: () => void;
  let waiting = true;
  const gate = new Promise<void>((resolve) => {
    release = () => {
      waiting = false;
      resolve();
    };
  });
  function Gate({ pending }: { pending: boolean }) {
    if (pending && waiting) throw gate;
    return null;
  }
  function Source() {
    const [version, setVersion] = useState(0);
    const callback = version === 0 ? first : version === 1 ? pendingCallback : final;
    return (
      <>
        <button onClick={() => startTransition(() => setVersion(1))}>pending</button>
        <button onClick={() => setVersion(2)}>abandon</button>
        <Suspense fallback={<span>waiting</span>}>
          <ServiceProvider scope={scope} services={[serviceInputs(Editor, { onSave: callback })]}>
            <Gate pending={version === 1} />
          </ServiceProvider>
        </Suspense>
      </>
    );
  }
  const view = render(<Source />);
  expect(editor.onSave).toBe(first);
  await act(async () => {
    fireEvent.click(screen.getByText('pending'));
  });
  expect(editor.onSave).toBe(first);
  await expect(editor.save()).resolves.toBe('Ada:first');
  await act(async () => {
    fireEvent.click(screen.getByText('abandon'));
  });
  expect(editor.onSave).toBe(final);
  await act(async () => {
    release();
    await gate;
  });
  expect(editor.onSave).toBe(final);
  await expect(editor.save()).resolves.toBe('Ada:final');
  view.unmount();
  scope.dispose();
});
