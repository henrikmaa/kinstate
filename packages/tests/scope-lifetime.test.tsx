import React, { StrictMode } from 'react';
import { act, render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { dependencies, Service } from '@kinstate/core';
import { ServiceProvider } from '@kinstate/react';

it('unmounts nested provider dependents before their ancestor resources under Strict Mode', async () => {
  const events: string[] = [];
  class Connection extends Service {
    ready = false;
    onInit() {
      this.ready = true;
      events.push('connection init');
    }
    onDispose() {
      this.ready = false;
      events.push('connection dispose');
    }
  }
  class Session extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
    onInit() {
      events.push('session init');
    }
    onDispose() {
      expect(this.connection.ready).toBe(true);
      events.push('session dispose');
    }
  }
  const view = render(
    <StrictMode>
      <ServiceProvider services={[Connection]}>
        <ServiceProvider services={[]}>
          <ServiceProvider services={[Session]}>
            <span>Ready</span>
          </ServiceProvider>
        </ServiceProvider>
      </ServiceProvider>
    </StrictMode>,
  );
  await act(async () => {});
  expect(events).toEqual(['connection init', 'session init']);
  await act(async () => {
    view.unmount();
  });
  expect(events).toEqual([
    'connection init',
    'session init',
    'session dispose',
    'connection dispose',
  ]);
});

it('cleans nested resources after a later ancestor registration fails during commit', async () => {
  const events: string[] = [];
  class Connection extends Service {
    ready = false;
    onInit() {
      this.ready = true;
      events.push('connection init');
    }
    onDispose() {
      this.ready = false;
      events.push('connection dispose');
    }
  }
  class Broken extends Service {
    onInit() {
      throw new Error('outer registration failed');
    }
  }
  class Session extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
    onInit() {
      events.push('session init');
    }
    onDispose() {
      expect(this.connection.ready).toBe(true);
      events.push('session dispose');
    }
  }
  class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    render() {
      return this.state.failed ? <span>Failed safely</span> : this.props.children;
    }
  }
  const original = console.error;
  console.error = () => {};
  try {
    const view = render(
      <Boundary>
        <ServiceProvider services={[Connection, Broken]}>
          <ServiceProvider services={[Session]}>
            <span>Ready</span>
          </ServiceProvider>
        </ServiceProvider>
      </Boundary>,
    );
    await act(async () => {});
    expect(view.container.textContent).toBe('Failed safely');
    expect(events).toEqual([
      'connection init',
      'session init',
      'session dispose',
      'connection dispose',
    ]);
    view.unmount();
  } finally {
    console.error = original;
  }
});
