import React, { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Service, ServiceScope, collectDependencies, flushSync, isReactive } from '@kinstate/core';
import { ServiceProvider, useService, type ServiceView } from '@kinstate/react';
import { readonlyServiceValue } from '../react/src/service-view.js';

class Users extends Service {
  users = [{ name: 'Ada' }, { name: 'Grace' }];
  selected = 0;
  frozen = Object.freeze({ nested: { name: 'frozen' } });
  constructorData = { constructor: { name: 'owned data' } };
  get selectedUser() {
    return this.users[this.selected]!;
  }
  rename(name: string) {
    this.selectedUser.name = name;
  }
  async renameAsync(name: string) {
    await Promise.resolve();
    this.rename(name);
    return this.selectedUser;
  }
  getUser() {
    return this.selectedUser;
  }
  getSelf() {
    return this;
  }
  echo<T>(value: T): T {
    return value;
  }
  lookup(value: string): string;
  lookup(value: number): number;
  lookup(value: string | number) {
    return value;
  }
  select(user: { name: string }) {
    this.users[0] = user;
  }
  updatePayload(payload: { row: { name: string } }) {
    payload.row.name = 'from command';
    this.select(payload.row);
  }
}
afterEach(cleanup);
const violation = /read-only.*service method/i;

describe('read-only React service views', () => {
  it('rejects the reported getter-result assignment before changing service state', () => {
    const scope = new ServiceScope([Users]);
    function UserName() {
      const users = useService(Users);
      // @ts-expect-error Getter results are deeply readonly for consumers.
      users.selectedUser.name = 'forbidden';
      return <span>{users.selectedUser.name}</span>;
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() =>
        render(
          <ServiceProvider services={[Users]} scope={scope}>
            <UserName />
          </ServiceProvider>,
        ),
      ).toThrow(violation);
      expect(scope.get(Users).selectedUser.name).toBe('Ada');
    } finally {
      consoleError.mockRestore();
      scope.dispose();
    }
  });

  it('rejects direct writes in event handlers and permits service commands', async () => {
    function UserName() {
      const users = useService(Users);
      const [error, setError] = useState('');
      return (
        <>
          <span data-testid="name">{users.selectedUser.name}</span>
          <span data-testid="error">{error}</span>
          <button
            onClick={() => {
              try {
                // @ts-expect-error Events do not receive mutable service state either.
                users.selectedUser.name = 'forbidden';
              } catch (failure) {
                setError(String(failure));
              }
            }}
          >
            direct
          </button>
          <button onClick={() => users.rename('command')}>command</button>
          <button onClick={() => users.renameAsync('async')}>async</button>
        </>
      );
    }
    render(
      <ServiceProvider services={[Users]}>
        <UserName />
      </ServiceProvider>,
    );
    fireEvent.click(screen.getByText('direct'));
    expect(screen.getByTestId('error').textContent).toMatch(violation);
    expect(screen.getByTestId('name').textContent).toBe('Ada');
    await act(async () => {
      fireEvent.click(screen.getByText('command'));
    });
    expect(screen.getByTestId('name').textContent).toBe('command');
    await act(async () => {
      fireEvent.click(screen.getByText('async'));
    });
    expect(screen.getByTestId('name').textContent).toBe('async');
  });

  it('blocks reflective, nested, array and frozen-object mutation paths', () => {
    const scope = new ServiceScope([Users]);
    const state = scope.get(Users);
    const view = readonlyServiceValue(state);
    expect(() => {
      // @ts-expect-error Consumer fields are readonly.
      view.selected = 1;
    }).toThrow(violation);
    expect(() => {
      // @ts-expect-error Consumer arrays have no mutating methods.
      view.users.push({ name: 'forbidden' });
    }).toThrow(violation);
    expect(() => Reflect.set(view.selectedUser, 'name', 'forbidden')).toThrow(violation);
    expect(() => Reflect.deleteProperty(view.selectedUser, 'name')).toThrow(violation);
    expect(() => Object.assign(view.selectedUser, { name: 'forbidden' })).toThrow(violation);
    expect(() => Object.defineProperty(view.selectedUser, 'name', { value: 'forbidden' })).toThrow(
      violation,
    );
    expect(() => Object.setPrototypeOf(view.selectedUser, null)).toThrow(violation);
    expect(() => Object.preventExtensions(view.selectedUser)).toThrow(violation);
    expect(() => Reflect.set(view.frozen.nested, 'name', 'forbidden')).toThrow(violation);
    expect(() => Reflect.set(view.constructorData.constructor, 'name', 'forbidden')).toThrow(
      violation,
    );
    const descriptor = Object.getOwnPropertyDescriptor(view, 'users')!;
    expect(descriptor.value).toBe(view.users);
    expect(() => descriptor.value.push({ name: 'forbidden' })).toThrow(violation);
    expect(state.users).toHaveLength(2);
    expect(state.selectedUser.name).toBe('Ada');
    expect(view instanceof Users).toBe(true);
    scope.dispose();
  });

  it('protects array callback arguments, iterators and returned projections', () => {
    const scope = new ServiceScope([Users]);
    const view = readonlyServiceValue(scope.get(Users));
    const assertReadonly = (row: { readonly name: string }) =>
      expect(() => Reflect.set(row, 'name', 'bad')).toThrow(violation);
    view.users
      .map((row, _index, array) => {
        assertReadonly(row);
        expect(array).toBe(view.users);
        return row;
      })
      .forEach(assertReadonly);
    view.users
      .filter((row, _index, array) => {
        assertReadonly(row);
        expect(array).toBe(view.users);
        return true;
      })
      .forEach(assertReadonly);
    view.users.forEach((row, _index, array) => {
      assertReadonly(row);
      expect(array).toBe(view.users);
    });
    assertReadonly(view.users.find(() => true)!);
    for (const row of view.users) assertReadonly(row);
    for (const [, row] of view.users.entries()) assertReadonly(row);
    expect(view.users.map((row) => row.name)).toEqual(['Ada', 'Grace']);
    const filtered = view.users.filter(() => true).sort((a, b) => b.name.localeCompare(a.name));
    filtered.push({ name: 'local' });
    expect(filtered).toHaveLength(3);
    expect(view.users).toHaveLength(2);
    assertReadonly(filtered[0]!);
    const projection = view.users.map((row) => ({ name: row.name }));
    projection[0]!.name = 'local projection';
    expect(view.selectedUser.name).toBe('Ada');
    scope.dispose();
  });

  it('protects method results and async resolutions while retaining command/generic signatures', async () => {
    const scope = new ServiceScope([Users]);
    const state = scope.get(Users);
    const view: ServiceView<Users> = readonlyServiceValue(state);
    const text: string = view.echo('typed');
    const numeric: number = view.lookup(3);
    const word: string = view.lookup('overloaded');
    expect([numeric, word]).toEqual([3, 'overloaded']);
    expect(text).toBe('typed');
    expect(view.getSelf()).toBe(view);
    expect(view.getUser()).toBe(view.selectedUser);
    expect(() => {
      view.getUser().name = 'forbidden';
    }).toThrow(violation);
    const result = await view.renameAsync('allowed');
    expect(result).toBe(view.selectedUser);
    expect(() => {
      result.name = 'forbidden';
    }).toThrow(violation);
    expect(state.selectedUser.name).toBe('allowed');
    const detached = view.rename;
    detached('detached');
    expect(state.selectedUser.name).toBe('detached');
    expect(detached).toBe(view.rename);
    scope.dispose();
  });

  it('normalizes view arguments for commands without changing caller containers', () => {
    const scope = new ServiceScope([Users]);
    const state = scope.get(Users);
    const view = readonlyServiceValue(state);
    const row = view.users[1]!;
    const payload = { row };
    view.updatePayload(payload);
    expect(payload.row).toBe(row);
    expect(view.selectedUser).toBe(row);
    expect(state.selectedUser).toBe(state.users[1]);
    expect(view.selectedUser.name).toBe('from command');
    scope.dispose();
  });

  it('keeps views stable and property/iteration dependencies selective', () => {
    const scope = new ServiceScope([Users]);
    const state = scope.get(Users);
    const view = readonlyServiceValue(state);
    expect(readonlyServiceValue(state)).toBe(view);
    expect(view).not.toBe(state);
    expect(isReactive(view)).toBe(true);
    expect(isReactive(view.selectedUser)).toBe(true);
    let notifications = 0;
    const captured = collectDependencies(() => Object.keys(view));
    const stops = [...captured.dependencies].map(([dep]) => dep.subscribe(() => notifications++));
    state.selected = 1;
    flushSync();
    expect(notifications).toBe(0);
    for (const stop of stops) stop();
    scope.dispose();
  });

  it('protects opaque collection values and permits their supported read operations', () => {
    class NativeState extends Service {
      map = new Map([[{ id: 1 }, { name: 'Ada' }]]);
      set = new Set([{ name: 'Grace' }]);
      date = new Date('2026-01-01T00:00:00Z');
      replace() {
        this.map = new Map([[{ id: 2 }, { name: 'Updated' }]]);
      }
    }
    const scope = new ServiceScope([NativeState]);
    const view = readonlyServiceValue(scope.get(NativeState));
    const key = [...view.map.keys()][0]!;
    expect(view.map.get(key)?.name).toBe('Ada');
    expect(() => Reflect.set(view.map.get(key)!, 'name', 'bad')).toThrow(violation);
    view.map.forEach((row, entry, map) => {
      expect(map).toBe(view.map);
      expect(entry).toBe(key);
      expect(() => Reflect.set(row, 'name', 'bad')).toThrow(violation);
    });
    expect(() => {
      // @ts-expect-error Map writes are not consumer commands.
      view.map.set(key, { name: 'bad' });
    }).toThrow(violation);
    expect(() => {
      // @ts-expect-error Set writes are not consumer commands.
      view.set.clear();
    }).toThrow(violation);
    expect(() => Reflect.set([...view.set][0]!, 'name', 'bad')).toThrow(violation);
    expect(view.date.getUTCFullYear()).toBe(2026);
    expect(() => {
      // @ts-expect-error Date setters are hidden from consumer types.
      view.date.setUTCFullYear(2020);
    }).toThrow(violation);
    view.replace();
    expect([...view.map.values()][0]?.name).toBe('Updated');
    scope.dispose();
  });

  it('does not grant mutable receivers to native overrides or spoofed iterators', () => {
    class CustomMap extends Map<string, number> {
      reset() {
        this.clear();
      }
      get size() {
        this.clear();
        return 0;
      }
    }
    class Cursor {
      [Symbol.toStringTag] = 'Map Iterator';
      count = 0;
      next() {
        this.count++;
        return { done: false, value: this.count };
      }
    }
    class State extends Service {
      map = new CustomMap([['key', 1]]);
      cursor = new Cursor();
      date = new Date('2026-01-01T00:00:00Z');
      constructor() {
        super();
        const date = this.date;
        date.valueOf = () => {
          date.setUTCFullYear(2020);
          return 0;
        };
      }
    }
    const scope = new ServiceScope([State]);
    const source = scope.get(State);
    const view = readonlyServiceValue(source);
    expect(() => {
      // @ts-expect-error Native subclasses do not gain consumer mutation methods.
      view.map.reset();
    }).toThrow(/opaque/i);
    expect(() => view.map.size).toThrow(/opaque/i);
    expect(Map.prototype.get.call(source.map, 'key')).toBe(1);
    expect(() => view.cursor.next()).toThrow(/opaque/i);
    expect(source.cursor.count).toBe(0);
    expect(() => view.date.toJSON()).toThrow(/opaque/i);
    expect(source.date.getUTCFullYear()).toBe(2026);
    scope.dispose();
  });
});
