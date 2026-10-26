import { describe, expect, it, vi } from 'vitest';
import {
  Service,
  ServiceScope,
  collectDependencies,
  flushSync,
  isReactive,
  observe,
  serviceInputs,
} from '../src/index.js';

interface Row {
  id: number;
  name: string;
}
class Data extends Service {
  rows: Row[] = [];
  owned = { count: 0 };
  onSave: (() => string) | undefined = undefined;
  get firstName() {
    return this.rows[0]?.name ?? 'empty';
  }
}

describe('service-owned external input boundary', () => {
  it('copies API collections and observes source replacements and service edits', () => {
    const rows = [{ id: 1, name: 'Ada' }];
    const scope = new ServiceScope([Data], { inputs: [serviceInputs(Data, { rows })] });
    const service = scope.get(Data);
    expect(service.rows).not.toBe(rows);
    expect(service.rows[0]).not.toBe(rows[0]);
    expect(service.rows.filter((row) => row.id === 1)[0]).toBe(service.rows[0]);
    expect(isReactive(service.rows)).toBe(true);
    const seen = vi.fn(() => service.firstName);
    const stop = observe(seen);
    expect(scope.applyInputs([serviceInputs(Data, { rows })])).toBe(false);
    flushSync();
    expect(seen).toHaveBeenCalledTimes(1);
    const replacement = [{ id: 1, name: 'Grace' }];
    expect(scope.applyInputs([serviceInputs(Data, { rows: replacement })])).toBe(true);
    flushSync();
    expect(service.firstName).toBe('Grace');
    expect(seen).toHaveBeenCalledTimes(2);
    expect(service.rows).not.toBe(replacement);
    stop();
    scope.dispose();
  });

  it('keeps service-owned nested state reactive and supplied callbacks unchanged', () => {
    const callback = () => 'saved';
    const scope = new ServiceScope([Data], {
      inputs: [serviceInputs(Data, { rows: [], onSave: callback })],
    });
    const service = scope.get(Data);
    const seen = vi.fn(() => service.owned.count);
    const stop = observe(seen);
    expect(isReactive(service.owned)).toBe(true);
    service.owned.count++;
    flushSync();
    expect(seen).toHaveBeenCalledTimes(2);
    expect(service.onSave).toBe(callback);
    expect(service.onSave!()).toBe('saved');
    stop();
    scope.dispose();
  });

  it('publishes a fresh copy on the first external binding of an existing raw source', () => {
    const rows = [{ id: 1, name: 'Ada' }];
    const scope = new ServiceScope([Data]);
    const service = scope.get(Data);
    service.rows = rows;
    const ownedProxy = service.rows;
    const capture = collectDependencies(() => service.rows);
    expect(capture.value).toBe(ownedProxy);
    expect(isReactive(ownedProxy)).toBe(true);
    const seen = vi.fn(() => service.rows);
    const stop = observe(seen);
    expect(scope.applyInputs([serviceInputs(Data, { rows })])).toBe(true);
    expect(
      [...capture.dependencies].some(
        ([dependency, version]) => dependency.getVersion() !== version,
      ),
    ).toBe(true);
    flushSync();
    expect(service.rows).not.toBe(rows);
    expect(seen).toHaveBeenCalledTimes(2);
    expect(scope.applyInputs([serviceInputs(Data, { rows })])).toBe(false);
    flushSync();
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    scope.dispose();
  });

  it('preserves explicitly supplied canonical proxies and their deep tracking', () => {
    const source = new Data();
    source.rows = [{ id: 1, name: 'Ada' }];
    const rowsProxy = source.rows;
    const raw = [{ id: 2, name: 'before' }];
    source.rows = raw;
    const canonical = source.rows;
    const scope = new ServiceScope([Data], { inputs: [serviceInputs(Data, { rows: raw })] });
    const service = scope.get(Data);
    const captured = collectDependencies(() => service.rows);
    const seen = vi.fn(() => service.firstName);
    const stop = observe(seen);
    expect(scope.applyInputs([serviceInputs(Data, { rows: canonical })])).toBe(true);
    expect(service.rows).toBe(canonical);
    expect(
      [...captured.dependencies].some(
        ([dependency, version]) => dependency.getVersion() !== version,
      ),
    ).toBe(true);
    flushSync();
    expect(scope.applyInputs([serviceInputs(Data, { rows: canonical })])).toBe(false);
    canonical[0]!.name = 'after';
    flushSync();
    expect(service.firstName).toBe('after');
    expect(seen).toHaveBeenCalledTimes(2);
    expect(scope.applyInputs([serviceInputs(Data, { rows: rowsProxy })])).toBe(true);
    flushSync();
    expect(service.firstName).toBe('Ada');
    rowsProxy[0]!.name = 'Grace';
    flushSync();
    expect(service.firstName).toBe('Grace');
    stop();
    scope.dispose();
  });

  it('does not treat external in-place mutation as an update signal', () => {
    const rows = [{ id: 1, name: 'Ada' }];
    const scope = new ServiceScope([Data], { inputs: [serviceInputs(Data, { rows })] });
    const service = scope.get(Data);
    const seen = vi.fn(() => service.firstName);
    const stop = observe(seen);
    rows[0]!.name = 'outside-contract';
    expect(scope.applyInputs([serviceInputs(Data, { rows })])).toBe(false);
    flushSync();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(service.firstName).toBe('Ada');
    // Source changes enter the service only when a replacement is published.
    scope.applyInputs([serviceInputs(Data, { rows: [...rows] })]);
    flushSync();
    expect(service.firstName).toBe('outside-contract');
    expect(seen).toHaveBeenCalledTimes(2);
    stop();
    scope.dispose();
  });
});
