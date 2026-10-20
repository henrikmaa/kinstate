import type { PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { discoverProgram } from './discovery.js';
import { prepareComponent } from './component.js';
import { analyzeAndGuardComponent } from './analysis.js';
import { instrumentComponent } from './instrumentation.js';
import { markComponent } from './prop-components.js';
import { collectImports } from './imports.js';
import { discoverReceiverWrappers, registerReceiverWrappers } from './wrapper-components.js';

export interface CompilerOptions {
  /** Public React package import. Useful for package aliases. */
  importSource?: string;
  /** Track ordinary receiving components; 'client' restricts this to use-client modules. */
  reactiveProps?: boolean | 'client';
}

/** Instrument authored components without installing a mutable global render collector. */
export default function kinstatePlugin(_api: unknown, options: CompilerOptions = {}): PluginObj {
  const source = options.importSource ?? '@kinstate/react';
  return {
    name: 'kinstate-render-tracking',
    visitor: {
      Program(program, state) {
        // Dependencies are precompiled distribution artifacts, never application consumers.
        const filename = state.file.opts.filename;
        if (filename && /(?:^|[\\/])node_modules(?:[\\/]|$)/.test(filename)) return;
        const reactiveProps =
          !program.node.directives.some((d) => d.value.value === 'use no service tracking') &&
          (options.reactiveProps === true ||
            (options.reactiveProps === 'client' &&
              program.node.directives.some((d) => d.value.value === 'use client')));
        const context = discoverProgram(program, source, reactiveProps);
        const wrappers = reactiveProps
          ? discoverReceiverWrappers(program, context?.imports ?? collectImports(program, source))
          : [];
        if (!context && !wrappers.length) return;
        const wrapperMarker = wrappers.length
          ? program.scope.generateUidIdentifier('markReactiveWrapper')
          : undefined;
        if (wrapperMarker) registerReceiverWrappers(wrappers, wrapperMarker);
        if (!context) {
          program.node.body.unshift(
            t.importDeclaration(
              [t.importSpecifier(wrapperMarker!, t.identifier('markReactiveWrapper'))],
              t.stringLiteral(`${source}/internal`),
            ),
          );
          return;
        }
        let frameHook: t.Identifier;
        do {
          frameHook = t.identifier(
            `useReactive${program.scope.generateUidIdentifier('renderFrame').name}`,
          );
        } while (
          program.scope.hasBinding(frameHook.name) ||
          program.scope.hasGlobal(frameHook.name)
        );

        const marker = reactiveProps
          ? program.scope.generateUidIdentifier('markReactiveComponent')
          : undefined;

        // Discover every owner first. Then analyze and instrument in source order,
        // keeping nested consumers isolated and generated identifiers deterministic.
        for (const [owner, calls] of context.owners) {
          const component = prepareComponent(context, owner, calls);
          analyzeAndGuardComponent(component);
          instrumentComponent(component, frameHook);
          if (marker) markComponent(owner, context.imports, marker);
        }
        program.node.body.unshift(
          t.importDeclaration(
            [
              t.importSpecifier(frameHook, t.identifier('useRenderFrame')),
              ...(marker ? [t.importSpecifier(marker, t.identifier('markReactiveComponent'))] : []),
              ...(wrapperMarker
                ? [t.importSpecifier(wrapperMarker, t.identifier('markReactiveWrapper'))]
                : []),
            ],
            t.stringLiteral(`${source}/internal`),
          ),
        );
      },
    },
  };
}
