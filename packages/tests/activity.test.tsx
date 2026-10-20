import React, { type ComponentType, type ReactNode } from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Service } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

// React 18 has no Activity. Its existing Strict Mode coverage runs separately.
const Activity = (
  React as unknown as {
    Activity?: ComponentType<{ mode: 'visible' | 'hidden'; children: ReactNode }>;
  }
).Activity;

it.skipIf(!Activity)(
  'pauses resources while Activity is hidden and resumes the same service instance',
  async () => {
    let instance: Resource | undefined;
    let initialized = 0;
    let disposed = 0;
    class Resource extends Service {
      count = 0;
      onInit() {
        instance = this;
        initialized++;
      }
      onDispose() {
        disposed++;
      }
    }
    function Display() {
      const service = useService(Resource);
      return <span>{service.count}</span>;
    }
    const Boundary = Activity!;
    const tree = (mode: 'visible' | 'hidden') => (
      <Boundary mode={mode}>
        <ServiceProvider services={[Resource]}>
          <Display />
        </ServiceProvider>
      </Boundary>
    );
    const view = render(tree('visible'));
    const original = instance!;
    await act(async () => {
      original.count = 4;
    });
    expect(screen.getByText('4')).toBeTruthy();
    expect(initialized).toBe(1);
    view.rerender(tree('hidden'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(disposed).toBe(1);
    view.rerender(tree('visible'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(instance).toBe(original);
    expect(initialized).toBe(2);
    expect(screen.getByText('4')).toBeTruthy();
    await act(async () => {
      original.count = 5;
    });
    expect(screen.getByText('5')).toBeTruthy();
    view.unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(disposed).toBe(2);
  },
);
