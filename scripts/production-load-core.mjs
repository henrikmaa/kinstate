import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import {
  Service,
  ServiceScope,
  batch,
  collectDependencies,
  flushSync,
  observe,
} from '../packages/core/src/index.ts';

if (!globalThis.gc) throw new Error('The load probe requires node --expose-gc --import tsx');
const extended = process.argv.includes('--long');
const config = {
  checkpoints: 8,
  scopesPerCheckpoint: extended ? 100 : 10,
  rows: extended ? 10000 : 2000,
  keysPerCheckpoint: extended ? 100000 : 10000,
};
let initialized = 0;
let disposed = 0;
let activeObservers = 0;
let effectRuns = 0;
class Dataset extends Service {
  alternate = false;
  left = 0;
  right = 0;
  rows = [];
  records = {};
  generation = 0;
  result = null;
  stop;
  get total() {
    return this.rows.reduce((sum, row) => sum + row.value, 0);
  }
  onInit() {
    initialized++;
    activeObservers++;
    this.stop = observe(() => {
      void (this.alternate ? this.right : this.left);
      effectRuns++;
    });
  }
  onDispose() {
    disposed++;
    activeObservers--;
    this.generation++;
    this.stop();
    this.stop = undefined;
  }
  async load(promise) {
    const generation = ++this.generation;
    const value = await promise;
    // Cancellation policy belongs to the service, including transports that ignore abort.
    if (generation === this.generation) this.result = value;
  }
}
async function gcCheckpoint() {
  for (let pass = 0; pass < 5; pass++) {
    await setImmediate();
    globalThis.gc();
  }
  await setImmediate();
  return process.memoryUsage().heapUsed;
}
function deferred() {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
async function scopeCycle() {
  const scope = new ServiceScope([Dataset]);
  const service = scope.get(Dataset);
  service.rows = Array.from({ length: config.rows }, (_, id) => ({ id, value: id % 100 }));
  scope.start();
  const nodes = [
    ...collectDependencies(() => [
      service.left,
      service.right,
      service.alternate,
      service.total,
    ]).dependencies.keys(),
  ];
  const stopTotal = observe(() => {
    assert.ok(Number.isFinite(service.total));
  });
  batch(() => {
    for (let row = 0; row < 100; row++) service.rows[row].value++;
    service.left++;
  });
  flushSync();
  service.alternate = true;
  flushSync();
  const before = effectRuns;
  service.left++;
  flushSync();
  assert.equal(effectRuns, before, 'Inactive conditional source retained an effect');
  const older = deferred();
  const newer = deferred();
  const oldLoad = service.load(older.promise);
  const newLoad = service.load(newer.promise);
  newer.resolve('new');
  await newLoad;
  older.resolve('old');
  await oldLoad;
  assert.equal(service.result, 'new');
  const abandoned = deferred();
  const pending = service.load(abandoned.promise);
  stopTotal();
  scope.dispose();
  abandoned.resolve('disposed');
  await pending;
  assert.equal(service.result, 'new', 'Disposed work published a late result');
  flushSync();
  assert.ok(
    nodes.every((node) => node.watchers.size === 0),
    'Scope/effect cleanup retained observers',
  );
  const beforeDisposedMutation = effectRuns;
  service.right++;
  flushSync();
  assert.equal(effectRuns, beforeDisposedMutation);
  assert.equal(activeObservers, 0);
  return { scope: new WeakRef(scope), service: new WeakRef(service) };
}
const persistent = new Dataset();
async function sample(index) {
  const released = [];
  for (let scope = 0; scope < config.scopesPerCheckpoint; scope++) {
    released.push(await scopeCycle());
    // WeakRef targets stay alive for the current event-loop job by specification.
    // Model separate request/mount turns rather than one unbounded synchronous job.
    await setImmediate();
  }
  for (let key = 0; key < config.keysPerCheckpoint; key++) {
    const name = `${index}-${key}`;
    const stop = observe(() => void persistent.records[name]);
    persistent.records[name] = key;
    delete persistent.records[name];
    stop();
    if (key > 0 && key % 10000 === 0) await setImmediate();
  }
  flushSync();
  const heapBytes = await gcCheckpoint();
  assert.ok(
    released.every((entry) => !entry.scope.deref() && !entry.service.deref()),
    'Released scopes/services survived repeated full GC checkpoints',
  );
  assert.equal(Object.keys(persistent.records).length, 0);
  return { index, heapBytes, initialized, disposed };
}
const started = performance.now();
// Warm module paths, proxy caches, JIT, and lifecycle machinery before measuring retained growth.
await sample(-1);
const checkpoints = [];
for (let index = 0; index < config.checkpoints; index++) checkpoints.push(await sample(index));
const baseline = checkpoints[0].heapBytes;
const tail = checkpoints.slice(-3).map((entry) => entry.heapBytes);
const retainedGrowthBytes = Math.max(...tail) - baseline;
const growthBudgetBytes = Math.max(16 * 1024 * 1024, baseline * 0.5);
assert.ok(
  retainedGrowthBytes <= growthBudgetBytes,
  `Retained heap grew ${retainedGrowthBytes} bytes (budget ${growthBudgetBytes})`,
);
assert.equal(initialized, disposed);
console.log(
  JSON.stringify({
    schemaVersion: 1,
    mode: extended ? 'long' : 'standard',
    runtime: process.version,
    config,
    durationMs: performance.now() - started,
    checkpoints,
    retainedGrowthBytes,
    growthBudgetBytes,
    initialized,
    disposed,
    activeObservers,
    historicalKeys: (config.checkpoints + 1) * config.keysPerCheckpoint,
    scopeCycles: initialized,
    note: 'Forced-GC retained heap, not peak memory or a timing benchmark. Async stale-result suppression is explicit service policy.',
  }),
);
