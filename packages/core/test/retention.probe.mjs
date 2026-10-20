// Run with: node --expose-gc --import tsx packages/core/test/retention.probe.mjs
// Every retained target stays alive through the final checkpoint. Finalizer delivery
// is asynchronous, so GC checkpoints cross event-loop turns before inspecting entries.
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { Service, collectDependencies, flushSync, observe } from '../src/index.ts';
import { PropertyAtoms } from '../src/reactive.ts';

if (!globalThis.gc) throw new Error('Run this probe with --expose-gc');
async function collectGarbage() {
  for (let pass = 0; pass < 8; pass++) {
    await setImmediate();
    globalThis.gc();
  }
  await setImmediate();
}
class Records extends Service {
  items = {};
}
const service = new Records();
const checkpoints = [];
async function checkpoint(label) {
  await collectGarbage();
  checkpoints.push({
    label,
    heapMiB: process.memoryUsage().heapUsed / 1024 / 1024,
    liveKeys: Object.keys(service.items).length,
  });
}
function churnUnobserved(start, end) {
  for (let index = start; index < end; index++) {
    const key = `id-${index}`;
    service.items[key] = index;
    delete service.items[key];
  }
  flushSync();
}
await checkpoint('baseline');
churnUnobserved(0, 50000);
await checkpoint('50k historical keys');
churnUnobserved(50000, 100000);
await checkpoint('100k historical keys');
assert.equal(checkpoints.at(-1).liveKeys, 0);
assert.ok(
  checkpoints.at(-1).heapMiB - checkpoints[0].heapMiB < 8,
  'Unobserved deleted keys retained memory',
);

const registry = new PropertyAtoms();
function churnObserved() {
  for (let index = 0; index < 25000; index++) {
    const key = `observed-${index}`;
    const { dependencies } = collectDependencies(() => registry.read(key));
    const dependency = dependencies.keys().next().value;
    const stop = dependency.subscribe(() => {});
    registry.changed(key);
    stop();
  }
  flushSync();
}
churnObserved();
const observedEntriesBeforeGC = registry.size;
await collectGarbage();
assert.equal(registry.size, 0, 'Released observations retained historical keys');

const held = collectDependencies(() => registry.read('captured'));
const dependency = held.dependencies.keys().next().value;
const capturedVersion = held.dependencies.get(dependency);
await collectGarbage();
registry.changed('captured');
assert.notEqual(dependency.getVersion(), capturedVersion);
const recaptured = collectDependencies(() => registry.read('captured'));
assert.equal(recaptured.dependencies.keys().next().value, dependency);
assert.equal(registry.size, 1, 'A retained render dependency lost its stable node');

class Active extends Service {
  count = 0;
  get doubled() {
    return this.count * 2;
  }
}
const plain = new Active();
const computed = new Active();
let plainEffects = 0;
let computedEffects = 0;
// Cleanup is deliberately not retained: the source owns active observations.
observe(() => {
  void plain.count;
  plainEffects++;
});
observe(() => {
  void computed.doubled;
  computedEffects++;
});
await collectGarbage();
plain.count++;
computed.count++;
flushSync();
assert.equal(plainEffects, 2, 'An active effect was collected because its cleanup was discarded');
assert.equal(computedEffects, 2, 'An active computed effect was collected');

const directRegistry = new PropertyAtoms();
let directDeliveries = 0;
const directListener = () => {
  directDeliveries++;
};
function directSubscription() {
  const { dependencies } = collectDependencies(() => directRegistry.read('direct'));
  const node = dependencies.keys().next().value;
  // Computed connections use direct watcher edges rather than public subscribe().
  node.watchers.add(directListener);
  return new WeakRef(node);
}
const directlyObserved = directSubscription();
await collectGarbage();
assert.ok(directlyObserved.deref(), 'A direct computed-style watcher edge lost its source node');
directRegistry.changed('direct');
assert.equal(directDeliveries, 1);
directlyObserved.deref().watchers.delete(directListener);
await collectGarbage();
assert.equal(directRegistry.size, 0, 'A removed direct watcher retained its source node');
function temporaryObservedSource() {
  const source = new Active();
  observe(() => void source.count);
  return new WeakRef(source);
}
const releasedSource = temporaryObservedSource();
await collectGarbage();
assert.equal(releasedSource.deref(), undefined, 'Source-owned observations became global GC roots');
console.log(
  JSON.stringify({
    checkpoints,
    observedEntriesBeforeGC,
    observedEntriesAfterGC: registry.size - 1,
    retainedCapturedEntries: registry.size,
    plainEffects,
    computedEffects,
    directDeliveries,
    releasedDirectEntries: directRegistry.size,
  }),
);
