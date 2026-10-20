import React, { forwardRef, memo, useCallback, useEffect, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Service, ServiceScope, flushSync } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

class State extends Service {
  name = 'Ada';
  count = 0;
  user: { name: string } | null = null;
  rows = [{ name: 'First' }];
  unrelated = 0;
  node: HTMLInputElement | null = null;
  load() {
    this.count++;
  }
}
const settle = async (update: () => void) => {
  await act(async () => {
    update();
    flushSync();
  });
};
afterEach(cleanup);

function Input({
  value,
  onChange,
}: {
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return <input aria-label="Name" value={value} onChange={onChange} />;
}
function Button({ children, onClick }: { children?: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick}>{children}</button>;
}
function Text({ children }: { children: React.ReactNode }) {
  return <span>{children}</span>;
}

describe('production compiler/runtime regressions', () => {
  it('supports controlled UI-kit props, commands, stable hook dependencies, and selective updates', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    let renders = 0;
    function Editor() {
      const service = useService(State);
      const increment = useCallback(() => {
        service.count++;
      }, [service]);
      useEffect(() => {
        service.load();
      }, [service]);
      renders++;
      return (
        <>
          <Input
            value={service.name}
            onChange={(event) => {
              service.name = event.target.value;
            }}
          />
          <Button onClick={increment}>
            <Text>{service.count}</Text>
          </Button>
        </>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Editor />
      </ServiceProvider>,
    );
    await settle(() => {});
    expect(screen.getByRole('button').textContent).toBe('1');
    await settle(() => {
      fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Grace' } });
    });
    expect(state.name).toBe('Grace');
    await settle(() => {
      fireEvent.click(screen.getByRole('button'));
    });
    expect(screen.getByRole('button').textContent).toBe('2');
    const before = renders;
    await settle(() => {
      state.unrelated++;
    });
    expect(renders).toBe(before);
    scope.dispose();
  });

  it('passes evaluated keyed elements and imperative refs through custom UI boundaries', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const Field = forwardRef<HTMLInputElement, { value: string }>(({ value }, ref) => (
      <input aria-label="Forwarded" ref={ref} value={value} readOnly />
    ));
    function Layout({ children }: { children: React.ReactNode }) {
      return <section>{children}</section>;
    }
    function Display() {
      const service = useService(State);
      return (
        <Layout>
          {service.rows.map((row) => (
            <Field
              key={row.name}
              value={row.name}
              ref={(node) => {
                service.node = node;
              }}
            />
          ))}
        </Layout>
      );
    }
    const view = render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    expect(state.node).toBe(screen.getByLabelText('Forwarded'));
    await settle(() => {
      state.rows[0]!.name = 'Next';
    });
    expect((screen.getByLabelText('Forwarded') as HTMLInputElement).value).toBe('Next');
    view.unmount();
    expect(state.node).toBe(null);
    scope.dispose();
  });

  it('preserves optional-chain short circuiting across members and calls', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    function Display() {
      const service = useService(State);
      return (
        <div data-testid="optional">
          {service.user?.name.toUpperCase() ?? 'Missing'}:{service.user?.name.length ?? 0}
        </div>
      );
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    expect(screen.getByTestId('optional').textContent).toBe('Missing:0');
    await settle(() => {
      state.user = { name: 'Ada' };
    });
    expect(screen.getByTestId('optional').textContent).toBe('ADA:3');
    await settle(() => {
      state.user = null;
    });
    expect(screen.getByTestId('optional').textContent).toBe('Missing:0');
    scope.dispose();
  });

  it('tracks for-of destructuring and destructuring assignments independently', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    function Loop() {
      const service = useService(State);
      let result = '';
      for (const { name } of service.rows) result += name;
      return <div data-testid="loop">{result}</div>;
    }
    function Assigned() {
      const service = useService(State);
      let name: string;
      ({ name } = service.rows[0]!);
      return <div data-testid="assigned">{name}</div>;
    }
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Loop />
        <Assigned />
      </ServiceProvider>,
    );
    await settle(() => {
      state.rows[0]!.name = 'Changed';
    });
    expect(screen.getByTestId('loop').textContent).toBe('Changed');
    expect(screen.getByTestId('assigned').textContent).toBe('Changed');
    scope.dispose();
  });

  it('supports anonymous memo/forwardRef consumers with local React state', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    const Display = memo(
      forwardRef<HTMLDivElement>(function (_props, ref) {
        const service = useService(State);
        const [suffix, setSuffix] = useState('!');
        return (
          <div ref={ref}>
            <Text>{service.name}</Text>
            <button onClick={() => setSuffix('?')}>{suffix}</button>
          </div>
        );
      }),
    );
    const ref = React.createRef<HTMLDivElement>();
    render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display ref={ref} />
      </ServiceProvider>,
    );
    await settle(() => {
      state.name = 'Grace';
    });
    expect(ref.current?.textContent).toBe('Grace!');
    fireEvent.click(screen.getByRole('button'));
    expect(ref.current?.textContent).toBe('Grace?');
    scope.dispose();
  });

  it('accepts evaluated plain list data but rejects live objects through UI props', async () => {
    const scope = new ServiceScope([State]);
    const state = scope.get(State);
    function List({ items }: { items: string[] }) {
      return <div>{items.join(',')}</div>;
    }
    function Display() {
      const service = useService(State);
      return <List items={service.rows.map((row) => row.name)} />;
    }
    const mounted = render(
      <ServiceProvider services={[State]} scope={scope}>
        <Display />
      </ServiceProvider>,
    );
    await settle(() => {
      state.rows[0]!.name = 'Updated';
    });
    expect(mounted.container.textContent).toBe('Updated');
    mounted.unmount();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Unsafe() {
      const service = useService(State);
      return <List items={service.rows as unknown as string[]} />;
    }
    class Boundary extends React.Component<{ children: React.ReactNode }, { error: boolean }> {
      state = { error: false };
      static getDerivedStateFromError() {
        return { error: true };
      }
      render() {
        return this.state.error ? <div>Rejected reactive prop</div> : this.props.children;
      }
    }
    try {
      render(
        <Boundary>
          <ServiceProvider services={[State]} scope={scope}>
            <Unsafe />
          </ServiceProvider>
        </Boundary>,
      );
      expect(screen.getByText('Rejected reactive prop')).toBeTruthy();
    } finally {
      error.mockRestore();
      scope.dispose();
    }
  });
});
