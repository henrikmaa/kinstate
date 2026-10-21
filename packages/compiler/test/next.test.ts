// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { NextConfig } from 'next';
import { withKinstate } from '../src/next.js';
import { transformNext } from '../src/next-transform.js';

describe('Next SWC-preserving integration', () => {
  it('preserves configuration and composes both bundlers without disabling SWC', async () => {
    const existing = { loaders: ['another-loader'] };
    const input: NextConfig = {
      compiler: { removeConsole: true },
      turbopack: { rules: { '*.tsx': existing } },
      webpack: (config) => ({ ...config, marker: true }),
    };
    const configured = withKinstate(input);
    expect(configured.compiler).toBe(input.compiler);
    expect(input.turbopack?.rules?.['*.tsx']).toBe(existing);
    expect(configured.turbopack?.rules?.['*.tsx']).toEqual([
      existing,
      expect.objectContaining({ condition: { not: 'foreign' } }),
    ]);
    const output = await configured.webpack!({ module: { rules: ['existing'] } }, {} as never);
    expect(output.marker).toBe(true);
    expect(output.module.rules[0]).toBe('existing');
    expect(output.module.rules[1]).toMatchObject({
      enforce: 'pre',
      use: [
        {
          loader: expect.stringMatching(/next-loader\.cjs$/),
          options: { reactiveProps: 'client' },
        },
      ],
    });
    expect(output.module.rules[1].exclude.test('/project/node_modules/library/index.js')).toBe(
      true,
    );
  });

  it('instruments tracking while retaining directives, TypeScript and JSX for SWC', async () => {
    const source = `'use client';import {useService} from '@kinstate/react';
      export default function Display(){const state=useService(Counter);const value:number=state.count;return <span>{value}</span>}`;
    const result = await transformNext(source, '/project/app/Display.tsx', {
      reactiveProps: 'client',
    });
    expect(result.code).toContain("'use client'");
    expect(result.code).toContain('value: number');
    expect(result.code).toContain('<span>');
    expect(result.code).toContain('_serviceFrame.track(() => state.count)');
    expect(result.map).toMatchObject({ sources: ['Display.tsx'], sourcesContent: [source] });
  });

  it('installs tracking on replacement Webpack configs returned by application hooks', async () => {
    const configured = withKinstate({ webpack: () => ({ module: { rules: ['replacement'] } }) });
    const output = await configured.webpack!({ module: { rules: ['discarded'] } }, {} as never);
    expect(output.module.rules).toEqual([
      'replacement',
      expect.objectContaining({ enforce: 'pre' }),
    ]);
  });

  it('diagnoses async Webpack hooks, which Next does not support', () => {
    const configured = withKinstate({ webpack: async (config) => config });
    expect(() => configured.webpack!({}, {} as never)).toThrow(
      /must return configuration synchronously/,
    );
  });

  it('preserves legacy TypeScript decorators in unrelated modules and mixed client modules', async () => {
    const model = `function entity(target: Function): void { void target; }
      @entity export class Model { count: number = 0; }`;
    for (const prefix of ['', "'use client';"]) {
      const result = await transformNext(prefix + model, '/app/model.ts', {
        reactiveProps: 'client',
      });
      expect(result.code).toContain('@entity');
      expect(result.code).toContain('count: number = 0');
      expect(result.code).not.toContain('useRenderFrame');
    }
    const result = await transformNext(
      `'use client'; ${model}
      import {useService} from '@kinstate/react';
      function Display(){const state=useService(Counter);return <span>{state.count}</span>}`,
      '/app/Display.tsx',
      { reactiveProps: 'client' },
    );
    expect(result.code).toContain('@entity');
    expect(result.code).toContain('_serviceFrame.track(() => state.count)');
  });

  it('keeps Server Components free of client hooks and forwards compiler diagnostics', async () => {
    const server = await transformNext(
      'export default async function Page(){return <div/>}',
      '/app/page.tsx',
      { reactiveProps: 'client' },
    );
    expect(server.code).not.toContain('useRenderFrame');
    await expect(
      transformNext(
        `import {useService} from '@kinstate/react';async function Display(){const s=useService(S);return s.count}`,
        '/app/bad.tsx',
        {},
      ),
    ).rejects.toThrow(/synchronous/);
  });
});
