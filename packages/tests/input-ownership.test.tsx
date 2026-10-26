import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { Service, ServiceScope, serviceInputs } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';
import { assertComponentBoundary } from '../react/src/boundaries.js';

afterEach(cleanup);

class Editor extends Service {
  profile = { name: '' };
  rename(name: string) {
    this.profile.name = name;
  }
}

it('keeps the same consuming API for editable input copies and selective updates', async () => {
  const source = { name: 'API' };
  const scope = new ServiceScope([Editor], {
    inputs: [serviceInputs(Editor, { profile: source })],
  });
  let renders = 0;
  function Name() {
    const editor = useService(Editor);
    renders++;
    return <span>{editor.profile.name}</span>;
  }
  const child = <Name />;
  const tree = () => (
    <ServiceProvider scope={scope} services={[serviceInputs(Editor, { profile: source })]}>
      {child}
    </ServiceProvider>
  );
  const view = render(tree());
  await act(async () => {
    scope.get(Editor).rename('edited');
  });
  expect(screen.getByText('edited')).toBeTruthy();
  expect(source.name).toBe('API');
  const baseline = renders;
  view.rerender(tree());
  expect(renders).toBe(baseline);
  expect(screen.getByText('edited')).toBeTruthy();
  view.unmount();
  scope.dispose();
});

it('continues to allow deeply frozen input data across uncompiled component boundaries', () => {
  class Frozen extends Service {
    data: readonly Readonly<{ label: string }>[] = [];
  }
  const source = Object.freeze([Object.freeze({ label: 'safe' })]);
  const scope = new ServiceScope([Frozen], { inputs: [serviceInputs(Frozen, { data: source })] });
  expect(scope.get(Frozen).data).not.toBe(source);
  expect(() => assertComponentBoundary(scope.get(Frozen).data, 'value')).not.toThrow();
  scope.dispose();
});
