import { describe, expect, it } from 'vitest';
import { dependencies, Service, ServiceScope } from '../src/index.js';
const checkpoint = async () => {
  for (let turn = 0; turn < 8; turn++) await Promise.resolve();
};
function fixture() {
  const events: string[] = [];
  class Connection extends Service {
    ready = false;
    onInit() {
      this.ready = true;
      events.push('connection init');
    }
    onDispose() {
      this.ready = false;
      events.push('connection dispose');
    }
  }
  class Session extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
    onInit() {
      expect(this.connection.ready).toBe(true);
      events.push('session init');
    }
    onDispose() {
      expect(this.connection.ready).toBe(true);
      events.push('session dispose');
    }
  }
  const parent = new ServiceScope([Connection]);
  const middle = new ServiceScope([], { parent });
  const child = new ServiceScope([Session], { parent: middle });
  return { events, Connection, Session, parent, middle, child };
}
describe('hierarchical resource lifetime', () => {
  it('keeps ancestors alive for active children and disposes three levels from the leaves', async () => {
    const { events, Connection, parent, middle, child } = fixture();
    const releaseParent = parent.acquire();
    const releaseMiddle = middle.acquire();
    const releaseChild = child.acquire();
    releaseParent();
    releaseMiddle();
    await checkpoint();
    expect(parent.get(Connection).ready).toBe(true);
    expect(events).toEqual(['connection init', 'session init']);
    releaseChild();
    await checkpoint();
    expect(events).toEqual([
      'connection init',
      'session init',
      'session dispose',
      'connection dispose',
    ]);
    child.dispose();
    middle.dispose();
    parent.dispose();
  });
  it('requires explicit owners to release active child scopes before terminal parent disposal', async () => {
    const { events, Connection, parent, middle, child } = fixture();
    parent.start();
    const releaseChild = child.acquire();
    expect(() => parent.dispose()).toThrow(/active child scopes/);
    expect(parent.get(Connection).ready).toBe(true);
    releaseChild();
    await checkpoint();
    expect(events).toEqual(['connection init', 'session init', 'session dispose']);
    expect(parent.get(Connection).ready).toBe(true);
    child.dispose();
    middle.dispose();
    parent.dispose();
    expect(events.at(-1)).toBe('connection dispose');
  });
  it('cancels pending ancestor cleanup when child and parent leases replay', async () => {
    const { events, parent, middle, child } = fixture();
    const firstParent = parent.acquire();
    const firstChild = child.acquire();
    firstParent();
    firstChild();
    const secondChild = child.acquire();
    const secondParent = parent.acquire();
    await checkpoint();
    expect(events).toEqual(['connection init', 'session init']);
    secondParent();
    secondChild();
    await checkpoint();
    expect(events).toEqual([
      'connection init',
      'session init',
      'session dispose',
      'connection dispose',
    ]);
    child.dispose();
    middle.dispose();
    parent.dispose();
  });
  it('releases a failed child activation hold and rolls back newly initialized local dependencies', () => {
    let opened = 0;
    class Local extends Service {
      onInit() {
        opened++;
      }
      onDispose() {
        opened--;
      }
    }
    class Broken extends Service {
      static inject = dependencies(Local);
      constructor(readonly local: Local) {
        super();
      }
      onInit() {
        throw new Error('failed child');
      }
    }
    const parent = new ServiceScope([]);
    const child = new ServiceScope([], { parent });
    expect(() => child.activate(Broken)).toThrow('failed child');
    expect(opened).toBe(0);
    expect(() => parent.dispose()).not.toThrow();
    child.dispose();
  });
  it('rejects activation beneath a disposed ancestor before initializing resources', () => {
    let initialized = 0;
    class Child extends Service {
      onInit() {
        initialized++;
      }
    }
    const parent = new ServiceScope([]);
    const child = new ServiceScope([Child], { parent });
    parent.dispose();
    expect(() => child.acquire()).toThrow(/disposed/);
    expect(initialized).toBe(0);
    child.dispose();
  });
  it('explicit start takes ownership from a pending lease cleanup', async () => {
    const { Connection, parent } = fixture();
    const release = parent.acquire();
    release();
    parent.start();
    await checkpoint();
    expect(parent.get(Connection).ready).toBe(true);
    parent.dispose();
  });
});

it('closes a failed ancestor startup after its active dependent finishes cleanup', async () => {
  const events: string[] = [];
  class Connection extends Service {
    ready = false;
    onInit() {
      this.ready = true;
      events.push('connection init');
    }
    onDispose() {
      this.ready = false;
      events.push('connection dispose');
    }
  }
  class Broken extends Service {
    onInit() {
      throw new Error('outer registration failed');
    }
  }
  class Session extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
    onDispose() {
      expect(this.connection.ready).toBe(true);
      events.push('session dispose');
    }
  }
  const parent = new ServiceScope([Connection, Broken]);
  const child = new ServiceScope([Session], { parent });
  const release = child.acquire();
  const connection = child.get(Session).connection;
  expect(() => parent.start()).toThrow('outer registration failed');
  expect(connection.ready).toBe(true);
  expect(() => parent.start()).toThrow(/startup failed/);
  expect(() => parent.activate(Connection)).toThrow(/startup failed/);
  expect(() => parent.dispose()).toThrow(/active child scopes/);
  release();
  await checkpoint();
  expect(events).toEqual(['connection init', 'session dispose', 'connection dispose']);
  expect(() => parent.get(Connection)).toThrow(/disposed/);
  child.dispose();
});

it('reinitializes ancestors before dependents after a fully inactive period', async () => {
  const { events, parent, middle, child } = fixture();
  let releaseParent = parent.acquire();
  let releaseChild = child.acquire();
  releaseParent();
  releaseChild();
  await checkpoint();
  releaseChild = child.acquire();
  releaseParent = parent.acquire();
  expect(events).toEqual([
    'connection init',
    'session init',
    'session dispose',
    'connection dispose',
    'connection init',
    'session init',
  ]);
  releaseParent();
  releaseChild();
  await checkpoint();
  expect(events.slice(-2)).toEqual(['session dispose', 'connection dispose']);
  child.dispose();
  middle.dispose();
  parent.dispose();
});

it('detaches a child lifetime hold even when its disposer throws', () => {
  class BrokenDispose extends Service {
    onDispose() {
      throw new Error('cleanup failed');
    }
  }
  const parent = new ServiceScope([]);
  const child = new ServiceScope([BrokenDispose], { parent });
  child.start();
  expect(() => child.dispose()).toThrow(/Service disposal failed/);
  expect(() => parent.dispose()).not.toThrow();
});

it('prevents failed-initialization cleanup from recursively initializing or creating services', () => {
  const scope = new ServiceScope([]);
  let attempts = 0;
  let constructions = 0;
  class Unconstructed extends Service {
    constructor() {
      super();
      constructions++;
    }
  }
  class Broken extends Service {
    onInit() {
      attempts++;
      throw new Error('initialization failed');
    }
    onDispose() {
      expect(scope.get(Broken)).toBe(this);
      expect(() => scope.get(Unconstructed)).toThrow(/scope cleanup/);
      expect(() => scope.activate(Broken)).toThrow(/scope cleanup/);
      expect(() => scope.start()).toThrow(/scope cleanup/);
      expect(() => scope.acquire()).toThrow(/scope cleanup/);
    }
  }
  expect(() => scope.activate(Broken)).toThrow('initialization failed');
  expect(attempts).toBe(1);
  expect(constructions).toBe(0);
  // Cleanup guards are temporary; an unrelated successful activation can recover.
  expect(() => scope.activate(Unconstructed)).not.toThrow();
  expect(constructions).toBe(1);
  scope.dispose();
});

it('preserves running ancestor/sibling resources and restores guards after rollback cleanup throws', async () => {
  let ready = false;
  let opened = 0;
  let local: Local | undefined;
  const parent = new ServiceScope([]);
  class Connection extends Service {
    onInit() {
      ready = true;
    }
    onDispose() {
      ready = false;
    }
  }
  class Session extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
  }
  const good = new ServiceScope([Session], { parent });
  const bad = new ServiceScope([], { parent });
  class Local extends Service {
    onInit() {
      local = this;
      opened++;
    }
    onDispose() {
      opened--;
      expect(bad.get(Local)).toBe(this);
      expect(bad.get(Connection)).toBe(parent.get(Connection));
      expect(() => bad.activate(Local)).toThrow(/scope cleanup/);
      throw new Error('rollback cleanup failed');
    }
  }
  class Broken extends Service {
    static inject = dependencies(Local);
    constructor(readonly local: Local) {
      super();
    }
    onInit() {
      throw new Error('activation failed');
    }
  }
  class Recovery extends Service {
    onInit() {
      expect(ready).toBe(true);
    }
  }
  parent.get(Connection);
  parent.start();
  const release = good.acquire();
  expect(() => bad.activate(Broken)).toThrow(/activation and cleanup failed/);
  expect(local).toBeDefined();
  expect(opened).toBe(0);
  expect(ready).toBe(true);
  expect(() => bad.activate(Recovery)).not.toThrow();
  bad.dispose();
  expect(ready).toBe(true);
  release();
  await checkpoint();
  good.dispose();
  parent.dispose();
  expect(ready).toBe(false);
});

it('rejects terminal disposal during lease cleanup while retaining terminal disposal idempotence', async () => {
  const events: string[] = [];
  const scope = new ServiceScope([]);
  let terminal = false;
  class Connection extends Service {
    ready = false;
    onInit() {
      this.ready = true;
    }
    onDispose() {
      this.ready = false;
      events.push('connection disposed');
    }
  }
  class Dependent extends Service {
    static inject = dependencies(Connection);
    constructor(readonly connection: Connection) {
      super();
    }
    onDispose() {
      events.push('dependent cleanup begins');
      expect(this.connection.ready).toBe(true);
      if (terminal) expect(() => scope.dispose()).not.toThrow();
      else expect(() => scope.dispose()).toThrow(/during cleanup/);
      expect(this.connection.ready).toBe(true);
      events.push('dependent cleanup ends');
    }
  }
  scope.get(Dependent);
  const release = scope.acquire();
  release();
  await checkpoint();
  expect(events).toEqual([
    'dependent cleanup begins',
    'dependent cleanup ends',
    'connection disposed',
  ]);
  scope.acquire();
  terminal = true;
  scope.dispose();
  expect(events.slice(3)).toEqual([
    'dependent cleanup begins',
    'dependent cleanup ends',
    'connection disposed',
  ]);
});

it('rejects disposal during rollback without destroying resources from a prior successful activation', () => {
  const scope = new ServiceScope([]);
  class Running extends Service {
    ready = false;
    onInit() {
      this.ready = true;
    }
    onDispose() {
      this.ready = false;
    }
  }
  const running = scope.activate(Running);
  class Local extends Service {
    onDispose() {
      expect(running.ready).toBe(true);
      expect(() => scope.dispose()).toThrow(/during cleanup/);
      expect(running.ready).toBe(true);
    }
  }
  class Broken extends Service {
    static inject = dependencies(Local);
    constructor(readonly local: Local) {
      super();
    }
    onInit() {
      throw new Error('activation failed');
    }
  }
  expect(() => scope.activate(Broken)).toThrow('activation failed');
  expect(running.ready).toBe(true);
  scope.dispose();
  expect(running.ready).toBe(false);
});
