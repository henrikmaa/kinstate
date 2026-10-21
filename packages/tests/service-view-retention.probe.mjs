// Keep the source and consumer alive while checking actual collection of removed callbacks.
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { Service, flushSync } from '@kinstate/core';
import { readonlyServiceValue } from '../react/src/service-view.ts';

if (!globalThis.gc) throw new Error('Run this probe with --expose-gc');
class Store extends Service {
  callbacks = {};
  rows = [];
}
const source = new Store();
const view = readonlyServiceValue(source);
const references = [];
function churn() {
  for (let index = 0; index < 500; index++) {
    const payload = { index };
    const callback = () => payload;
    references.push(new WeakRef(callback));
    source.callbacks[`item-${index}`] = callback;
    assert.equal(view.callbacks[`item-${index}`]().index, index);
    delete source.callbacks[`item-${index}`];
  }
}
churn();
flushSync();
for (let pass = 0; pass < 8; pass++) {
  await setImmediate();
  globalThis.gc();
}
await setImmediate();
const retained = references.filter((reference) => reference.deref()).length;
assert.equal(Object.keys(source.callbacks).length, 0);
assert.equal(Object.keys(view.callbacks).length, 0);
assert.equal(
  retained,
  0,
  'Removed callback functions must not be retained by a live consumer view',
);
console.log(JSON.stringify({ removed: references.length, retained }));
