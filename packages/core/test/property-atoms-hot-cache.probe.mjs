// Run with --expose-gc --import tsx. Cache entries must not root inactive nodes.
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { collectDependencies, flushSync } from '../src/index.ts';
import { PropertyAtoms } from '../src/reactive.ts';

if (!globalThis.gc) throw new Error('Run this probe with --expose-gc');
const registry = new PropertyAtoms();
async function collectGarbage() {
  for (let pass = 0; pass < 10; pass++) {
    await setImmediate();
    globalThis.gc();
  }
  await setImmediate();
}
function prime() {
  const weak = [];
  for (const key of ['value', 'id', Symbol('field'), undefined]) {
    const captured = collectDependencies(() => registry.read(key));
    const node = captured.dependencies.keys().next().value;
    const stop = node.subscribe(() => {});
    registry.changed(key);
    flushSync();
    stop();
    weak.push(new WeakRef(node));
  }
  return weak;
}
const original = prime();
await collectGarbage();
assert.equal(registry.size, 0, 'Hot cache retained finalized property entries in the map');
assert.ok(
  original.every((reference) => reference.deref() === undefined),
  'Hot entry retained an inactive Atom',
);
let deliveries = 0;
function recreate() {
  // Undefined is deliberately the most recent finalized cache key.
  const first = collectDependencies(() => registry.read(undefined));
  const node = first.dependencies.keys().next().value;
  const stop = node.subscribe(() => {
    deliveries++;
  });
  registry.changed(undefined);
  flushSync();
  assert.equal(node.getVersion(), 1);
  const again = collectDependencies(() => registry.read(undefined));
  assert.equal(again.dependencies.keys().next().value, node);
  stop();
  const second = collectDependencies(() => registry.read('id'));
  const secondNode = second.dependencies.keys().next().value;
  registry.changed('id');
  assert.equal(secondNode.getVersion(), 1);
  return [new WeakRef(node), new WeakRef(secondNode)];
}
const recreated = recreate();
await collectGarbage();
assert.equal(deliveries, 1);
assert.equal(registry.size, 0, 'Recreated hot entries were not released');
assert.ok(recreated.every((reference) => reference.deref() === undefined));
console.log(
  JSON.stringify({
    originalCollected: original.length,
    recreatedCollected: recreated.length,
    entriesAfterGC: registry.size,
    deliveries,
  }),
);
