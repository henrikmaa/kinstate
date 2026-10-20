import React from 'react';
import { afterEach, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Service, ServiceScope } from '@kinstate/core';
import { ServiceProvider, useService } from '@kinstate/react';

afterEach(cleanup);

it('keeps callback reads reactive while event reads add no render dependencies', async () => {
  class List extends Service {
    entries = [
      { id: 1, label: 'one' },
      { id: 2, label: 'two' },
    ];
    ignored = 0;
    inspect() {
      return this.ignored;
    }
  }
  const scope = new ServiceScope([List]);
  const list = scope.get(List);
  let renders = 0;
  function View() {
    const service = useService(List);
    renders++;
    return (
      <div>
        <button onClick={() => service.inspect()}>inspect</button>
        {service.entries.map((entry) => (
          <span key={entry.id}>{entry.label}</span>
        ))}
      </div>
    );
  }
  render(
    <ServiceProvider services={[List]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  await act(async () => {
    fireEvent.click(screen.getByText('inspect'));
  });
  const baseline = renders;
  await act(async () => {
    list.ignored++;
  });
  expect(renders).toBe(baseline);
  await act(async () => {
    list.entries[1]!.label = 'changed';
  });
  expect(screen.getByText('changed')).toBeTruthy();
  expect(renders - baseline).toBe(1);
  scope.dispose();
});

it('replaces computed dependencies when a branch changes', async () => {
  class Branch extends Service {
    useFirst = true;
    first = 1;
    second = 2;
    get selected() {
      return this.useFirst ? this.first : this.second;
    }
  }
  const scope = new ServiceScope([Branch]);
  const branch = scope.get(Branch);
  let renders = 0;
  function View() {
    const service = useService(Branch);
    renders++;
    return <span>{service.selected}</span>;
  }
  render(
    <ServiceProvider services={[Branch]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  await act(async () => {
    branch.useFirst = false;
  });
  const baseline = renders;
  await act(async () => {
    branch.first = 99;
  });
  expect(renders).toBe(baseline);
  await act(async () => {
    branch.second = 7;
  });
  expect(screen.getByText('7')).toBeTruthy();
  expect(renders - baseline).toBe(1);
  scope.dispose();
});

it('tracks synchronous service method reads during rendering', async () => {
  class Reader extends Service {
    count = 1;
    ignored = 0;
    read() {
      return this.count * 3;
    }
  }
  const scope = new ServiceScope([Reader]);
  const reader = scope.get(Reader);
  let renders = 0;
  function View() {
    const service = useService(Reader);
    renders++;
    return <span>{service.read()}</span>;
  }
  render(
    <ServiceProvider services={[Reader]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  const baseline = renders;
  await act(async () => {
    reader.ignored++;
  });
  expect(renders).toBe(baseline);
  await act(async () => {
    reader.count = 2;
  });
  expect(screen.getByText('6')).toBeTruthy();
  expect(renders - baseline).toBe(1);
  scope.dispose();
});

it('preserves Object.is semantics for NaN and signed zero', async () => {
  class Numeric extends Service {
    value = Number.NaN;
  }
  const scope = new ServiceScope([Numeric]);
  const numeric = scope.get(Numeric);
  let renders = 0;
  function View() {
    const service = useService(Numeric);
    renders++;
    return <span>{String(service.value)}</span>;
  }
  render(
    <ServiceProvider services={[Numeric]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  const baseline = renders;
  await act(async () => {
    numeric.value = Number.NaN;
  });
  expect(renders).toBe(baseline);
  await act(async () => {
    numeric.value = 0;
  });
  const zeroRenders = renders;
  await act(async () => {
    numeric.value = -0;
  });
  expect(renders - zeroRenders).toBe(1);
  scope.dispose();
});

it('tracks destructured service and nested property reads', async () => {
  class Structured extends Service {
    count = 0;
    user = { name: 'Ada' };
  }
  const scope = new ServiceScope([Structured]);
  const structured = scope.get(Structured);
  function View() {
    const service = useService(Structured);
    const { count } = service;
    const { name } = service.user;
    return (
      <span>
        {count}:{name}
      </span>
    );
  }
  render(
    <ServiceProvider services={[Structured]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  await act(async () => {
    structured.count = 2;
    structured.user.name = 'Grace';
  });
  expect(screen.getByText('2:Grace')).toBeTruthy();
  scope.dispose();
});

it('tracks for-of array iteration and for-in key enumeration', async () => {
  class Collections extends Service {
    items = [1, 2];
    record: Record<string, number> = { a: 1 };
  }
  const scope = new ServiceScope([Collections]);
  const collections = scope.get(Collections);
  function View() {
    const service = useService(Collections);
    let total = 0;
    let keys = '';
    for (const item of service.items) total += item;
    for (const key in service.record) keys += key;
    return (
      <span>
        {total}:{keys}
      </span>
    );
  }
  render(
    <ServiceProvider services={[Collections]} scope={scope}>
      <View />
    </ServiceProvider>,
  );
  await act(async () => {
    collections.items.push(3);
    collections.record.b = 2;
  });
  expect(screen.getByText('6:ab')).toBeTruthy();
  await act(async () => {
    collections.items[0] = 10;
    delete collections.record.a;
  });
  expect(screen.getByText('15:b')).toBeTruthy();
  scope.dispose();
});
