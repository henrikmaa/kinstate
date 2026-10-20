import { expect, it } from 'vitest';
import { collectDependencies, type Dependency, Service } from '../src/index.js';

class State extends Service {
  first = 0;
  second = 0;
  third = 0;
}

it('does not propagate older destination reads into a new enclosing observation', () => {
  const state = new State();
  const destination = new Map<Dependency, number>();
  collectDependencies(() => state.first, destination);
  const previous = [...destination.keys()][0]!;
  const outer = collectDependencies(() => collectDependencies(() => state.second, destination));
  expect(destination.size).toBe(2);
  expect(outer.dependencies.size).toBe(1);
  expect(outer.dependencies.has(previous)).toBe(false);
});

it('retains reads in the supplied destination when the observation throws', () => {
  const state = new State();
  const captured = new Map<Dependency, number>();
  const failure = new Error('failure');
  expect(() =>
    collectDependencies(() => {
      void state.first;
      throw failure;
    }, captured),
  ).toThrow(failure);
  expect(captured.size).toBe(1);
  state.first++;
  expect([...captured].some(([dependency, version]) => dependency.getVersion() !== version)).toBe(
    true,
  );
  const unrelated = collectDependencies(() => state.second);
  expect(unrelated.dependencies.size).toBe(1);
  expect([...unrelated.dependencies.keys()].some((dependency) => captured.has(dependency))).toBe(
    false,
  );
});

it('accumulates earliest versions across successful, nested and exceptional reads', () => {
  const state = new State();
  const captured = new Map<Dependency, number>();
  const result = collectDependencies(() => state.first, captured);
  expect(result.dependencies).toEqual(captured);
  const [first, version] = [...captured][0]!;
  state.first++;
  collectDependencies(() => {
    void state.first;
    collectDependencies(() => state.second, captured);
    try {
      collectDependencies(() => {
        void state.third;
        throw null;
      }, captured);
    } catch {
      /* The enclosing observation deliberately renders its fallback. */
    }
  }, captured);
  expect(captured.size).toBe(3);
  expect(captured.get(first!)).toBe(version);
  expect(first!.getVersion()).not.toBe(version);
});

it('propagates exceptional nested reads to the outer collector and restores it', () => {
  const state = new State();
  const captured = new Map<Dependency, number>();
  const outer = collectDependencies(() => {
    try {
      collectDependencies(() => {
        void state.first;
        throw 0;
      }, captured);
    } catch {
      /* Continue collecting in the parent after an error. */
    }
    return state.second;
  });
  expect(captured.size).toBe(1);
  expect(outer.dependencies.size).toBe(2);
  expect([...captured.keys()].every((dependency) => outer.dependencies.has(dependency))).toBe(true);
});
