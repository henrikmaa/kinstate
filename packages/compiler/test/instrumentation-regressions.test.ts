import { transformSync, type ParserOptions } from '@babel/core';
import type * as t from '@babel/types';
import { Service } from '@kinstate/core';
import { RenderFrame } from '@kinstate/react/internal';
import { describe, expect, it } from 'vitest';
import plugin from '../src/index.js';

/** Execute emitted JavaScript, then inspect the actual runtime dependency versions. */
function compile(
  body: string,
  service: Service,
  context: Record<string, unknown> = {},
  parserOpts: ParserOptions = {},
) {
  const transformed = transformSync(
    `import { useService } from '@kinstate/react'; function Counter(){const service=useService(S);${body}}`,
    {
      filename: 'instrumentation-fixture.tsx',
      configFile: false,
      babelrc: false,
      ast: true,
      parserOpts: { plugins: ['typescript', 'jsx'], ...parserOpts },
      plugins: [plugin],
      presets: [['@babel/preset-typescript', { allExtensions: true, isTSX: true }]],
    },
  )!;
  const frameImport = transformed.ast!.program.body.find(
    (node): node is t.ImportDeclaration =>
      node.type === 'ImportDeclaration' && node.source.value.endsWith('/internal'),
  )!;
  const frameName = frameImport.specifiers[0]!.local.name;
  let frame: RenderFrame;
  const component = new Function(
    'useService',
    'S',
    frameName,
    ...Object.keys(context),
    `${transformed.code!.replace(/^import[^;]*;\n/gm, '')};return Counter;`,
  )(
    () => service,
    class {},
    () => (frame = new RenderFrame()),
    ...Object.values(context),
  ) as () => unknown;
  return { render: component, frame: () => frame! };
}

function expectTracked(compiled: ReturnType<typeof compile>, mutate: () => void) {
  const before = compiled.frame().getSnapshot();
  mutate();
  expect(compiled.frame().getSnapshot()).not.toBe(before);
}

describe('executed optional-chain semantics', () => {
  class State extends Service {
    user: null | { name: string; method?: (value?: string) => string } = null;
  }

  it.each(['name.length', 'name.toUpperCase()', 'method().length'])(
    'short-circuits the entire %s continuation',
    (continuation) => {
      const service = new State();
      const compiled = compile(`return service.user?.${continuation}`, service);
      expect(compiled.render()).toBeUndefined();
      service.user = {
        name: 'Ada',
        method() {
          return this.name;
        },
      };
      expect(compiled.render()).toBe(continuation.includes('UpperCase') ? 'ADA' : 3);
      expectTracked(compiled, () => {
        service.user!.name = 'Grace';
      });
    },
  );

  it.each([false, true])(
    'preserves parenthesized receiver references (explicit AST: %s)',
    (explicit) => {
      const service = new State();
      const calls: unknown[] = [];
      service.user = {
        name: 'Ada',
        method(value) {
          calls.push(this, value);
          return this.name;
        },
      };
      const compiled = compile(
        'return (service.user?.method)(argument())',
        service,
        {
          argument: () => {
            calls.push('argument');
            return 'value';
          },
        },
        { createParenthesizedExpressions: explicit },
      );
      expect(compiled.render()).toBe('Ada');
      expect(calls).toEqual(['argument', service.user, 'value']);
      expectTracked(compiled, () => {
        service.user!.name = 'Grace';
      });
      service.user = null;
      calls.length = 0;
      expect(() => compiled.render()).toThrow(TypeError);
      expect(calls).toEqual(['argument']);
      const brokenChain = compile(
        'return (service.user?.name).length',
        service,
        {},
        { createParenthesizedExpressions: explicit },
      );
      expect(() => brokenChain.render()).toThrow(TypeError);
    },
  );

  it('preserves optional calls, skipped arguments and their receiver', () => {
    const service = new State();
    const calls: unknown[] = [];
    const compiled = compile('return service.user?.method?.(argument())?.length', service, {
      argument: () => {
        calls.push('argument');
        return 'value';
      },
    });
    expect(compiled.render()).toBeUndefined();
    expect(calls).toEqual([]);
    service.user = { name: 'Ada' };
    expect(compiled.render()).toBeUndefined();
    expect(calls).toEqual([]);
    service.user.method = function (value) {
      calls.push(this, value);
      return this.name;
    };
    expect(compiled.render()).toBe(3);
    expect(calls).toEqual(['argument', service.user, 'value']);
  });

  it('keeps TypeScript non-null assertions inside an optional chain', () => {
    const service = new State();
    const compiled = compile('return service.user?.name!.length', service);
    expect(compiled.render()).toBeUndefined();
    service.user = { name: 'Ada' };
    expect(compiled.render()).toBe(3);
    expectTracked(compiled, () => {
      service.user!.name = 'Grace';
    });
    const receiver = compile('return (service.user?.method as Function)()', service);
    service.user.method = function () {
      return this.name;
    };
    expect(receiver.render()).toBe('Grace');
  });

  it('preserves delete short-circuiting and computed-key evaluation', () => {
    const service = new State();
    let calls = 0;
    const compiled = compile('return delete service.user?.[key()]', service, {
      key: () => {
        calls++;
        return 'name';
      },
    });
    expect(compiled.render()).toBe(true);
    expect(calls).toBe(0);
    service.user = { name: 'Ada' };
    expect(compiled.render()).toBe(true);
    expect(calls).toBe(1);
    expect('name' in service.user).toBe(false);
  });
});

describe('executed destructuring reads', () => {
  class State extends Service {
    rows = [
      { name: 'Ada', nested: { value: 1 }, extra: 2 },
      { name: 'Grace', nested: { value: 3 }, extra: 4 },
    ];
    matrix = [
      [1, 2, 3],
      [4, 5],
    ];
    user = { name: 'Ada', age: 37 };
  }

  it('tracks object patterns in for-of headers', () => {
    const service = new State();
    const compiled = compile(
      'let out="";for(const {name} of service.rows){out+=name}return out',
      service,
    );
    expect(compiled.render()).toBe('AdaGrace');
    expectTracked(compiled, () => {
      service.rows[0]!.name = 'Marie';
    });
    expect(compiled.render()).toBe('MarieGrace');
  });

  it('preserves nested defaults, computed keys, rest and a single iterable evaluation', () => {
    const service = new State();
    const trace: string[] = [];
    const compiled = compile(
      'let out=0;for(const {[key()]:{value=7}={},...rest} of iterable(service.rows)){out+=value+rest.extra}return out',
      service,
      {
        key: () => {
          trace.push('key');
          return 'nested';
        },
        iterable: (value: unknown) => {
          trace.push('iterable');
          return value;
        },
      },
    );
    expect(compiled.render()).toBe(10);
    expect(trace).toEqual(['iterable', 'key', 'key']);
    expectTracked(compiled, () => {
      service.rows[0]!.nested.value = 10;
    });
    expect(compiled.render()).toBe(19);
  });

  it('tracks array rest and preserves elisions and defaults', () => {
    const service = new State();
    const compiled = compile(
      'let out=0;for(const [head=7,,...tail] of service.matrix){out+=head+(tail[0]??0)}return out',
      service,
    );
    expect(compiled.render()).toBe(8);
    expectTracked(compiled, () => {
      service.matrix[0]![0] = 9;
    });
    expect(compiled.render()).toBe(16);
  });

  it('preserves body shadowing, labels, continue and break', () => {
    const service = new State();
    const compiled = compile(
      'let out="";outer:for(const {name} of service.rows){{let name="local";out+=name}if(name==="Ada")continue outer;out+=name;break outer}return out',
      service,
    );
    expect(compiled.render()).toBe('locallocalGrace');
    expectTracked(compiled, () => {
      service.rows[1]!.name = 'Marie';
    });
  });

  it('preserves per-iteration let bindings used by body closures', () => {
    const service = new State();
    const compiled = compile(
      'const readers=[];for(let {name} of service.rows){name+="!";readers.push(()=>name)}return readers.map(read=>read()).join(",")',
      service,
    );
    expect(compiled.render()).toBe('Ada!,Grace!');
  });

  it('preserves function defaults capturing immutable const loop bindings', () => {
    const service = new State();
    const compiled = compile(
      'const readers=[];for(const {name,read=()=>name} of service.rows){readers.push(read)}return readers.map(read=>read()).join(",")',
      service,
    );
    expect(compiled.render()).toBe('Ada,Grace');
  });

  it('supports unchanged let bindings and shadowing inside iterable callbacks', () => {
    const service = new State();
    const compiled = compile(
      'const readers=[];for(let {name,read=()=>name} of service.rows.map(name=>name)){readers.push(read)}return readers.map(read=>read()).join(",")',
      service,
    );
    expect(compiled.render()).toBe('Ada,Grace');
    const shadowed = compile(
      'let out="";for(let {name,read=(name="local")=>name} of service.rows){name+="!";out+=read()}return out',
      service,
    );
    expect(shadowed.render()).toBe('locallocal');
  });

  it('preserves shared var bindings and sequential assignment visible to getters', () => {
    const service = new State();
    const compiled = compile(
      'const readers=[];for(var {name,read=()=>name} of service.rows){readers.push(read)}return readers.map(read=>read()).join(",")',
      service,
    );
    expect(compiled.render()).toBe('Grace,Grace');
    const getters = compile(
      'const items=[{first:1,get second(){return x}}];let out;for(var {first:x,second:y} of items){out=y}return out',
      service,
    );
    expect(getters.render()).toBe(1);
  });

  it('tracks assignment patterns in loop headers without redeclaring targets', () => {
    const service = new State();
    const compiled = compile(
      'let name;let out="";for({name} of service.rows){out+=name}return name+":"+out',
      service,
    );
    expect(compiled.render()).toBe('Grace:AdaGrace');
    expectTracked(compiled, () => {
      service.rows[1]!.name = 'Marie';
    });
  });

  it('retains iterator early-exit cleanup', () => {
    const service = new State();
    const trace: string[] = [];
    const iterable = {
      *[Symbol.iterator]() {
        try {
          yield service.rows[0]!;
          yield service.rows[1]!;
        } finally {
          trace.push('closed');
        }
      },
    };
    const compiled = compile('for(const {name} of iterable){return name}return "empty"', service, {
      iterable,
    });
    expect(compiled.render()).toBe('Ada');
    expect(trace).toEqual(['closed']);
  });

  it('tracks destructuring assignments and retains the original RHS identity', () => {
    const service = new State();
    let calls = 0;
    const compiled = compile(
      'let name,rest;const result=({name,...rest}=source(service.user));return [result===service.user,name,rest.age].join(":")',
      service,
      {
        source: (value: unknown) => {
          calls++;
          return value;
        },
      },
    );
    expect(compiled.render()).toBe('true:Ada:37');
    expect(calls).toBe(1);
    expectTracked(compiled, () => {
      service.user.name = 'Grace';
    });
  });

  it('preserves assignment defaults capturing live outer bindings', () => {
    const service = new State();
    const compiled = compile(
      'let name,read;({name,read=()=>name}=service.user);name="changed";return read()',
      service,
    );
    expect(compiled.render()).toBe('changed');
  });

  it('diagnoses lexical loop closures whose mutable bindings cannot be preserved', () => {
    const service = new State();
    expect(() =>
      compile(
        'for(let {name,read=()=>name} of service.rows){name="changed";return read()}',
        service,
      ),
    ).toThrow(/mutable let bindings/);
    expect(() => compile('for(const {rows} of rows){return rows}', service)).toThrow(
      /iterable cannot reference bindings/,
    );
  });
});

describe('executed tagged-template calls', () => {
  it('preserves receiver, template-site caching and interpolation evaluation', () => {
    const templates: TemplateStringsArray[] = [];
    const receivers: unknown[] = [];
    class State extends Service {
      nested = {
        prefix: 'hello:',
        tag(this: { prefix: string }, strings: TemplateStringsArray, value: string) {
          templates.push(strings);
          receivers.push(this);
          return this.prefix + strings[0] + value;
        },
      };
    }
    const service = new State();
    let argumentsEvaluated = 0;
    const compiled = compile('return service.nested.tag`name:${argument()}`', service, {
      argument: () => {
        argumentsEvaluated++;
        return 'Ada';
      },
    });
    expect(compiled.render()).toBe('hello:name:Ada');
    expect(compiled.render()).toBe('hello:name:Ada');
    expect(argumentsEvaluated).toBe(2);
    expect(templates[0]).toBe(templates[1]);
    expect(receivers).toEqual([service.nested, service.nested]);
    expectTracked(compiled, () => {
      service.nested.prefix = 'goodbye:';
    });
    expect(compiled.render()).toBe('goodbye:name:Ada');
  });
});
