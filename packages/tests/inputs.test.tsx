import React, {
  StrictMode,
  Suspense,
  startTransition,
  useState,
  createContext,
  useContext,
} from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { Service, ServiceScope, dependencies, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

interface User {
  name: string;
}
class UserService extends Service {
  user: Readonly<User> | undefined = undefined;
  isLoading = false;
  draft = '';
  get label() {
    return this.user?.name ?? 'empty';
  }
  edit(value: string) {
    this.draft = value;
  }
}

it('seeds inputs before rendering and initialization, preserving local state and identity on updates', async () => {
  const initialized: string[] = [];
  let instance!: Profile;
  class Profile extends UserService {
    onInit() {
      instance = this;
      initialized.push(this.label);
    }
  }
  function Display() {
    const service = useService(Profile);
    return (
      <span>
        {service.label}:{service.draft}
      </span>
    );
  }
  const child = <Display />;
  const view = render(
    <ServiceProvider services={[serviceInputs(Profile, { user: { name: 'Ada' } })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Ada:')).toBeTruthy();
  expect(initialized).toEqual(['Ada']);
  const original = instance;
  const edit = instance.edit;
  await act(async () => {
    edit('local draft');
  });
  view.rerender(
    <ServiceProvider services={[serviceInputs(Profile, { user: { name: 'Grace' } })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Grace:local draft')).toBeTruthy();
  expect(instance).toBe(original);
  expect(instance.edit).toBe(edit);
  expect(initialized).toEqual(['Ada']);
});

it('accepts arbitrary React state and only renders consumers of changed input fields', async () => {
  const renders = { user: 0, loading: 0 };
  const ada = Object.freeze({ name: 'Ada' });
  function UserDisplay() {
    const service = useService(UserService);
    renders.user++;
    return <span>{service.label}</span>;
  }
  function LoadingDisplay() {
    const service = useService(UserService);
    renders.loading++;
    return <span>{service.isLoading ? 'loading' : 'ready'}</span>;
  }
  const children = (
    <>
      <UserDisplay />
      <LoadingDisplay />
    </>
  );
  function Source() {
    const [user, setUser] = useState<Readonly<User> | undefined>(ada);
    const [loading, setLoading] = useState(false);
    const [revision, setRevision] = useState(0);
    return (
      <>
        <button onClick={() => setUser({ name: 'Grace' })}>replace</button>
        <button onClick={() => setUser(undefined)}>clear</button>
        <button onClick={() => setLoading(true)}>load</button>
        <button onClick={() => setRevision(revision + 1)}>same inputs</button>
        <ServiceProvider services={[serviceInputs(UserService, { user, isLoading: loading })]}>
          {children}
        </ServiceProvider>
      </>
    );
  }
  render(<Source />);
  const initial = { ...renders };
  await act(async () => {
    fireEvent.click(screen.getByText('same inputs'));
  });
  expect(renders).toEqual(initial);
  await act(async () => {
    fireEvent.click(screen.getByText('load'));
  });
  expect(renders.user).toBe(initial.user);
  expect(renders.loading - initial.loading).toBe(1);
  await act(async () => {
    fireEvent.click(screen.getByText('replace'));
  });
  expect(screen.getByText('Grace')).toBeTruthy();
  expect(renders.user - initial.user).toBe(1);
  expect(renders.loading - initial.loading).toBe(1);
  await act(async () => {
    fireEvent.click(screen.getByText('clear'));
  });
  expect(screen.getByText('empty')).toBeTruthy();
});

it('allows input keys to change and leaves omitted fields unchanged', () => {
  function Display() {
    const service = useService(UserService);
    return (
      <span>
        {service.label}:{String(service.isLoading)}
      </span>
    );
  }
  const child = <Display />;
  const view = render(
    <ServiceProvider services={[serviceInputs(UserService, { user: { name: 'Ada' } })]}>
      {child}
    </ServiceProvider>,
  );
  view.rerender(
    <ServiceProvider services={[serviceInputs(UserService, { isLoading: true })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Ada:true')).toBeTruthy();
  view.rerender(
    <ServiceProvider services={[serviceInputs(UserService, { user: undefined, isLoading: false })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('empty:false')).toBeTruthy();
});

it('batches multiple input fields into one consumer update', () => {
  let renders = 0;
  function Display() {
    const service = useService(UserService);
    renders++;
    return (
      <span>
        {service.label}:{String(service.isLoading)}
      </span>
    );
  }
  const child = <Display />;
  const view = render(
    <ServiceProvider
      services={[serviceInputs(UserService, { user: { name: 'Ada' }, isLoading: true })]}
    >
      {child}
    </ServiceProvider>,
  );
  const baseline = renders;
  view.rerender(
    <ServiceProvider
      services={[serviceInputs(UserService, { user: { name: 'Grace' }, isLoading: false })]}
    >
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Grace:false')).toBeTruthy();
  expect(renders - baseline).toBe(1);
});

it('reasserts supplied input values on provider commits while preserving unbound local state', async () => {
  const scope = new ServiceScope([UserService]);
  const service = scope.get(UserService);
  const user = { name: 'Ada' };
  const tree = () => (
    <ServiceProvider scope={scope} services={[serviceInputs(UserService, { user })]} />
  );
  const view = render(tree());
  await act(async () => {
    service.user = { name: 'local' };
    service.draft = 'keep';
  });
  expect(service.label).toBe('local');
  view.rerender(tree());
  expect(service.label).toBe('Ada');
  expect(service.draft).toBe('keep');
  view.unmount();
  scope.dispose();
});

it('rejects duplicate service registrations including mixed input bindings', () => {
  const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    expect(() =>
      render(
        <ServiceProvider
          services={[UserService, serviceInputs(UserService, { isLoading: true })]}
        />,
      ),
    ).toThrow(/duplicate/i);
  } finally {
    errors.mockRestore();
  }
});

it('applies supplied-scope inputs at commit without mutating during render or taking disposal ownership', () => {
  const scope = new ServiceScope([UserService]);
  const service = scope.get(UserService);
  service.user = { name: 'before' };
  const seenDuringRender: string[] = [];
  function Probe() {
    seenDuringRender.push(service.label);
    return null;
  }
  const view = render(
    <ServiceProvider
      scope={scope}
      services={[serviceInputs(UserService, { user: { name: 'after' } })]}
    >
      <Probe />
    </ServiceProvider>,
  );
  expect(seenDuringRender).toEqual(['before']);
  expect(service.label).toBe('after');
  view.unmount();
  expect(scope.get(UserService)).toBe(service);
  scope.dispose();
});

it('propagates external inputs through computed getters in injected services', () => {
  class Greeting extends Service {
    static inject = dependencies(UserService);
    constructor(private readonly users: UserService) {
      super();
    }
    get greeting() {
      return `Hello ${this.users.label}`;
    }
  }
  function Display() {
    const service = useService(Greeting);
    return <span>{service.greeting}</span>;
  }
  const child = <Display />;
  const view = render(
    <ServiceProvider services={[Greeting, serviceInputs(UserService, { user: { name: 'Ada' } })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Hello Ada')).toBeTruthy();
  view.rerender(
    <ServiceProvider services={[Greeting, serviceInputs(UserService, { user: { name: 'Grace' } })]}>
      {child}
    </ServiceProvider>,
  );
  expect(screen.getByText('Hello Grace')).toBeTruthy();
});

it('keeps nested input bindings isolated', () => {
  function Display({ id }: { id: string }) {
    const service = useService(UserService);
    return <span data-testid={id}>{service.label}</span>;
  }
  const outer = <Display id="outer" />;
  const inner = <Display id="inner" />;
  const tree = (name: string) => (
    <ServiceProvider services={[serviceInputs(UserService, { user: { name } })]}>
      {outer}
      <ServiceProvider services={[serviceInputs(UserService, { user: { name: 'inner' } })]}>
        {inner}
      </ServiceProvider>
    </ServiceProvider>
  );
  const view = render(tree('outer'));
  view.rerender(tree('changed'));
  expect(screen.getByTestId('outer').textContent).toBe('changed');
  expect(screen.getByTestId('inner').textContent).toBe('inner');
});

it('initializes and disposes a bound service once under Strict Mode', async () => {
  const events: string[] = [];
  class Resource extends UserService {
    onInit() {
      events.push(`init ${this.label}`);
    }
    onDispose() {
      events.push('dispose');
    }
  }
  function Display() {
    const service = useService(Resource);
    return <span>{service.label}</span>;
  }
  const view = render(
    <StrictMode>
      <ServiceProvider services={[serviceInputs(Resource, { user: { name: 'Ada' } })]}>
        <Display />
      </ServiceProvider>
    </StrictMode>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(events).toEqual(['init Ada']);
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(events).toEqual(['init Ada', 'dispose']);
});

it('seeds server-owned scopes per request and hydrates matching inputs', async () => {
  function Display() {
    const service = useService(UserService);
    return <span>{service.label}</span>;
  }
  const tree = (name: string) => (
    <ServiceProvider services={[serviceInputs(UserService, { user: { name } })]}>
      <Display />
    </ServiceProvider>
  );
  const html = renderToString(tree('Ada'));
  expect(html).toContain('Ada');
  expect(renderToString(tree('Grace'))).toContain('Grace');
  const container = document.createElement('div');
  container.innerHTML = html;
  document.body.append(container);
  const errors: unknown[] = [];
  let root!: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => {
      root = hydrateRoot(container, tree('Ada'), {
        onRecoverableError: (error) => errors.push(error),
      });
    });
    expect(container.textContent).toBe('Ada');
    expect(errors).toEqual([]);
  } finally {
    if (root)
      await act(async () => {
        root.unmount();
      });
    container.remove();
  }
});

it('does not publish input values from a suspended or abandoned transition', async () => {
  const scope = new ServiceScope([UserService]);
  const service = scope.get(UserService);
  service.user = { name: 'Ada' };
  let release!: () => void;
  let pending = true;
  const gate = new Promise<void>((resolve) => {
    release = () => {
      pending = false;
      resolve();
    };
  });
  function Display() {
    const state = useService(UserService);
    return <span data-testid="committed-user">{state.label}</span>;
  }
  function Gate({ name }: { name: string }) {
    if (name === 'Grace' && pending) throw gate;
    return null;
  }
  const child = <Display />;
  function Source() {
    const [name, setName] = useState('Ada');
    return (
      <>
        <button onClick={() => startTransition(() => setName('Grace'))}>transition</button>
        <button onClick={() => setName('Lin')}>abandon</button>
        <Suspense fallback={<span>waiting</span>}>
          <ServiceProvider
            scope={scope}
            services={[serviceInputs(UserService, { user: { name } })]}
          >
            {child}
            <Gate name={name} />
          </ServiceProvider>
        </Suspense>
      </>
    );
  }
  const view = render(<Source />);
  await act(async () => {
    fireEvent.click(screen.getByText('transition'));
  });
  expect(service.label).toBe('Ada');
  expect(screen.getByTestId('committed-user').textContent).toBe('Ada');
  await act(async () => {
    fireEvent.click(screen.getByText('abandon'));
  });
  expect(service.label).toBe('Lin');
  expect(screen.getByTestId('committed-user').textContent).toBe('Lin');
  await act(async () => {
    release();
    await gate;
  });
  expect(service.label).toBe('Lin');
  view.unmount();
  scope.dispose();
});

it('publishes transitioned inputs only after the suspended render commits', async () => {
  const scope = new ServiceScope([UserService]);
  const service = scope.get(UserService);
  service.user = { name: 'Ada' };
  let release!: () => void;
  let pending = true;
  const gate = new Promise<void>((resolve) => {
    release = () => {
      pending = false;
      resolve();
    };
  });
  function Display() {
    const state = useService(UserService);
    return <span data-testid="transitioned-user">{state.label}</span>;
  }
  function Gate({ next }: { next: boolean }) {
    if (next && pending) throw gate;
    return null;
  }
  const child = <Display />;
  function Source() {
    const [next, setNext] = useState(false);
    return (
      <>
        <button onClick={() => startTransition(() => setNext(true))}>next</button>
        <Suspense fallback={<span>waiting</span>}>
          <ServiceProvider
            scope={scope}
            services={[serviceInputs(UserService, { user: { name: next ? 'Grace' : 'Ada' } })]}
          >
            {child}
            <Gate next={next} />
          </ServiceProvider>
        </Suspense>
      </>
    );
  }
  const view = render(<Source />);
  await act(async () => {
    fireEvent.click(screen.getByText('next'));
  });
  expect(service.label).toBe('Ada');
  expect(screen.getByTestId('transitioned-user').textContent).toBe('Ada');
  await act(async () => {
    release();
    await gate;
  });
  expect(service.label).toBe('Grace');
  expect(screen.getByTestId('transitioned-user').textContent).toBe('Grace');
  view.unmount();
  scope.dispose();
});

it('accepts state from a custom hook backed by React context', () => {
  const SourceContext = createContext<Readonly<User>>({ name: 'Ada' });
  function useSource() {
    return useContext(SourceContext);
  }
  function Display() {
    const service = useService(UserService);
    return <span>{service.label}</span>;
  }
  const child = <Display />;
  function Bridge() {
    const user = useSource();
    return (
      <ServiceProvider services={[serviceInputs(UserService, { user })]}>{child}</ServiceProvider>
    );
  }
  const view = render(
    <SourceContext.Provider value={{ name: 'Ada' }}>
      <Bridge />
    </SourceContext.Provider>,
  );
  view.rerender(
    <SourceContext.Provider value={{ name: 'Grace' }}>
      <Bridge />
    </SourceContext.Provider>,
  );
  expect(screen.getByText('Grace')).toBeTruthy();
});

it('supports a source hook suspending before producing provider inputs', async () => {
  const scope = new ServiceScope([UserService]);
  const original = scope.get(UserService);
  let ready = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = () => {
      ready = true;
      resolve();
    };
  });
  function useSource(next: boolean) {
    if (next && !ready) throw gate;
    return { name: next ? 'Grace' : 'Ada' };
  }
  function Display() {
    const service = useService(UserService);
    return <span>{service.label}</span>;
  }
  const child = <Display />;
  function Bridge({ next }: { next: boolean }) {
    const user = useSource(next);
    return (
      <ServiceProvider scope={scope} services={[serviceInputs(UserService, { user })]}>
        {child}
      </ServiceProvider>
    );
  }
  function Source() {
    const [next, setNext] = useState(false);
    return (
      <>
        <button onClick={() => startTransition(() => setNext(true))}>new source</button>
        <Suspense fallback={<span>waiting for source</span>}>
          <Bridge next={next} />
        </Suspense>
      </>
    );
  }
  const view = render(<Source />);
  await act(async () => {
    fireEvent.click(screen.getByText('new source'));
  });
  expect(original.label).toBe('Ada');
  expect(screen.getByText('Ada')).toBeTruthy();
  await act(async () => {
    release();
    await gate;
  });
  expect(screen.getByText('Grace')).toBeTruthy();
  expect(scope.get(UserService)).toBe(original);
  view.unmount();
  scope.dispose();
});
