import React, { StrictMode, Suspense, startTransition, useLayoutEffect, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Service, ServiceScope, batch, dependencies } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

class State extends Service {
  count = 0;
  name = 'initial';
  user = { name: 'Ada', age: 30 };
  items = [1, 2];
  record: Record<string, number> = {};
  get doubled() {
    return this.count * 2;
  }
  get parity() {
    return this.count % 2;
  }
  increment() {
    this.count++;
  }
  twice() {
    this.increment();
    this.increment();
  }
  async load() {
    await Promise.resolve();
    this.count = 8;
  }
}

function harness() {
  const scope = new ServiceScope([State]);
  return { scope, state: scope.get(State) };
}

describe('reactive service acceptance', () => {
  it('tracks computed getters and multiple services independently', async () => {
    class Other extends Service {
      value = 'other';
    }
    const scope = new ServiceScope([State, Other]);
    const state = scope.get(State);
    const other = scope.get(Other);
    let renders = 0;
    function Display() {
      const first = useService(State);
      const second = useService(Other);
      renders++;
      return (
        <span>
          {first.doubled}:{second.value}
        </span>
      );
    }
    render(
      <ServiceProvider services={[State, Other]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    await act(async () => {
      state.count = 3;
    });
    expect(screen.getByText('6:other')).toBeTruthy();
    const baseline = renders;
    await act(async () => {
      state.name = 'unobserved';
    });
    expect(renders).toBe(baseline);
    await act(async () => {
      other.value = 'updated';
    });
    expect(screen.getByText('6:updated')).toBeTruthy();
    scope.dispose();
  });

  it('tracks nested objects, array indices and length without unrelated rerenders', async () => {
    const { scope, state } = harness();
    const renders = { name: 0, length: 0, first: 0 };
    function Name() {
      const s = useService(State);
      renders.name++;
      return <span>{s.user.name}</span>;
    }
    function Length() {
      const s = useService(State);
      renders.length++;
      return <span data-testid="length">{s.items.length}</span>;
    }
    function First() {
      const s = useService(State);
      renders.first++;
      return <span data-testid="first">{s.items[0]}</span>;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Name />
        <Length />
        <First />
      </ServiceProvider>,
    );
    const baseline = { ...renders };
    await act(async () => {
      state.user.age++;
      state.items.push(3);
    });
    expect(renders.name).toBe(baseline.name);
    expect(renders.first).toBe(baseline.first);
    expect(screen.getByTestId('length').textContent).toBe('3');
    await act(async () => {
      state.user = { name: 'Grace', age: 40 };
      state.items[0] = 9;
    });
    expect(screen.getByText('Grace')).toBeTruthy();
    expect(screen.getByTestId('first').textContent).toBe('9');
    await act(async () => {
      state.items.length = 0;
    });
    expect(screen.getByTestId('first').textContent).toBe('');
    scope.dispose();
  });

  it('tracks added and deleted keys, key enumeration, and membership', async () => {
    const { scope, state } = harness();
    function Display() {
      const s = useService(State);
      return (
        <span>
          {Object.keys(s.record).join(',')}:{'a' in s.record ? s.record.a : 'absent'}
        </span>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    expect(screen.getByText(':absent')).toBeTruthy();
    await act(async () => {
      state.record.a = 2;
    });
    expect(screen.getByText('a:2')).toBeTruthy();
    await act(async () => {
      delete state.record.a;
    });
    expect(screen.getByText(':absent')).toBeTruthy();
    scope.dispose();
  });

  it('batches nested methods and explicit batches, and supports async updates', async () => {
    const { scope, state } = harness();
    let renders = 0;
    function Display() {
      const s = useService(State);
      renders++;
      return <span>{s.count}</span>;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    const baseline = renders;
    await act(async () => {
      state.twice();
    });
    expect(renders - baseline).toBe(1);
    const next = renders;
    await act(async () => {
      batch(() => {
        state.count++;
        state.count++;
        state.count++;
      });
    });
    expect(renders - next).toBe(1);
    await act(async () => {
      await state.load();
    });
    expect(screen.getByText('8')).toBeTruthy();
    scope.dispose();
  });

  it('suppresses notifications for Object.is-equal values and unchanged computed results', async () => {
    const { scope, state } = harness();
    let renders = 0;
    function Display() {
      const s = useService(State);
      renders++;
      return <span>{s.parity}</span>;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    const baseline = renders;
    await act(async () => {
      state.count = 0;
    });
    expect(renders).toBe(baseline);
    await act(async () => {
      state.count = 2;
    });
    expect(renders).toBe(baseline);
    await act(async () => {
      state.count = 3;
    });
    expect(renders - baseline).toBe(1);
    scope.dispose();
  });

  it('stops rendering after unmount and permits repeated clean mounts', async () => {
    const { scope, state } = harness();
    let renders = 0;
    function Display() {
      const s = useService(State);
      renders++;
      return <span>{s.count}</span>;
    }
    const view = render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    view.unmount();
    const baseline = renders;
    await act(async () => {
      state.increment();
    });
    expect(renders).toBe(baseline);
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    expect(screen.getByText('1')).toBeTruthy();
    scope.dispose();
  });

  it('isolates sibling and nested provider instances', async () => {
    function Display({ id }: { id: string }) {
      const s = useService(State);
      return (
        <button data-testid={id} onClick={() => s.increment()}>
          {s.count}
        </button>
      );
    }
    render(
      <>
        <ServiceProvider services={[State]}>
          <Display id="outer" />
          <ServiceProvider services={[State]}>
            <Display id="inner" />
          </ServiceProvider>
        </ServiceProvider>
        <ServiceProvider services={[State]}>
          <Display id="sibling" />
        </ServiceProvider>
      </>,
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('inner'));
    });
    expect(screen.getByTestId('inner').textContent).toBe('1');
    expect(screen.getByTestId('outer').textContent).toBe('0');
    expect(screen.getByTestId('sibling').textContent).toBe('0');
  });

  it('initializes once through Strict Mode replay and disposes once on final unmount', async () => {
    const events: string[] = [];
    class Resource extends Service {
      value = 0;
      onInit() {
        events.push('init');
      }
      onDispose() {
        events.push('dispose');
      }
    }
    function Display() {
      const s = useService(Resource);
      return <span>{s.value}</span>;
    }
    const view = render(
      <StrictMode>
        <ServiceProvider services={[Resource]}>
          <Display />
        </ServiceProvider>
      </StrictMode>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(events).toEqual(['init']);
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(events).toEqual(['init', 'dispose']);
  });

  it('detects an update made between render and subscription installation', async () => {
    const { scope, state } = harness();
    function Display() {
      const s = useService(State);
      return <span>{s.count}</span>;
    }
    function Mutator() {
      useLayoutEffect(() => {
        state.count = 7;
      }, []);
      return null;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
        <Mutator />
      </ServiceProvider>,
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByText('7')).toBeTruthy();
    scope.dispose();
  });

  it('does not commit stale state after a suspended transition', async () => {
    const { scope, state } = harness();
    let unblock!: () => void;
    let waiting = true;
    const gate = new Promise<void>((resolve) => {
      unblock = () => {
        waiting = false;
        resolve();
      };
    });
    function Display({ alternate }: { alternate: boolean }) {
      const s = useService(State);
      const value = alternate ? s.name : String(s.count);
      if (alternate && waiting) throw gate;
      return <span data-testid="transition-value">{value}</span>;
    }
    function App() {
      const [alternate, setAlternate] = useState(false);
      return (
        <>
          <button onClick={() => startTransition(() => setAlternate(true))}>switch</button>
          <Suspense fallback={<span>waiting</span>}>
            <Display alternate={alternate} />
          </Suspense>
        </>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <App />
      </ServiceProvider>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('switch'));
    });
    expect(screen.getByTestId('transition-value').textContent).toBe('0');
    await act(async () => {
      state.name = 'latest';
      state.count = 4;
    });
    expect(screen.getByTestId('transition-value').textContent).toBe('4');
    await act(async () => {
      unblock();
      await gate;
    });
    expect(screen.getByTestId('transition-value').textContent).toBe('latest');
    scope.dispose();
  });

  it('keeps SSR requests independent and hydrates explicit initial state', async () => {
    function Display() {
      const s = useService(State);
      return <span>{s.count}</span>;
    }
    const first = new ServiceScope([State]);
    const second = new ServiceScope([State]);
    first.get(State).count = 12;
    const firstTree = (
      <ServiceProvider services={[State]} scope={first}>
        <Display />
      </ServiceProvider>
    );
    const secondTree = (
      <ServiceProvider services={[State]} scope={second}>
        <Display />
      </ServiceProvider>
    );
    expect(renderToString(firstTree)).toContain('12');
    expect(renderToString(secondTree)).toContain('0');
    const container = document.createElement('div');
    container.innerHTML = renderToString(firstTree);
    document.body.append(container);
    const errors: unknown[] = [];
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(
        container,
        <ServiceProvider
          services={[State]}
          initialState={[{ service: State, state: { count: 12 } }]}
        >
          <Display />
        </ServiceProvider>,
        { onRecoverableError: (error) => errors.push(error) },
      );
    });
    expect(container.textContent).toBe('12');
    expect(errors).toEqual([]);
    await act(async () => {
      root.unmount();
    });
    container.remove();
    first.dispose();
    second.dispose();
  });

  it('preserves inherited methods, bound references, setters, and typed service injection outside React', async () => {
    class Base extends Service {
      count = 1;
      increment() {
        this.count++;
      }
    }
    class Derived extends Base {
      get total() {
        return this.count * 2;
      }
      set total(value: number) {
        this.count = value / 2;
      }
      nested() {
        this.increment();
      }
    }
    class Consumer extends Service {
      static inject = dependencies(Derived);
      constructor(readonly derived: Derived) {
        super();
      }
      read() {
        return this.derived.total;
      }
    }
    const scope = new ServiceScope([Derived, Consumer]);
    const derived = scope.get(Derived);
    const increment = derived.increment;
    increment();
    derived.nested();
    expect(derived.total).toBe(6);
    derived.total = 20;
    expect(scope.get(Consumer).read()).toBe(20);
    expect(scope.get(Derived)).toBe(derived);
    expect(derived.increment).toBe(increment);
    scope.dispose();
  });
});
