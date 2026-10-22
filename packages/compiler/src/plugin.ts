import type { PluginObj } from '@babel/core';
import * as t from '@babel/types';
import { discoverProgram } from './discovery.js';
import { prepareComponent } from './component.js';
import { analyzeAndGuardComponent } from './analysis.js';
import { instrumentComponent } from './instrumentation.js';
import { markComponent } from './prop-components.js';
import { collectImports } from './imports.js';
import { hasReactModuleEvidence } from './react-module.js';
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
          hasReactModuleEvidence(program, filename, source) &&
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
        // Prefixing Babel-generated names can create a new collision, including
        // with bindings in nested component scopes that program.hasBinding misses.
        const hasIdentifier = (name: string): boolean => {
          let found = false;
          t.traverseFast(program.node, (node) => {
            if (t.isIdentifier(node, { name })) found = true;
          });
          return found;
        };
        let frameHook: t.Identifier;
        do {
          frameHook = t.identifier(
            `useReactive${program.scope.generateUidIdentifier('renderFrame').name}`,
          );
        } while (
          program.scope.hasBinding(frameHook.name) ||
          program.scope.hasGlobal(frameHook.name) ||
          hasIdentifier(frameHook.name)
        );

        let memoHook: t.Identifier;
        do {
          memoHook = t.identifier(
            `useReactive${program.scope.generateUidIdentifier('serviceMemo').name}`,
          );
        } while (
          program.scope.hasBinding(memoHook.name) ||
          program.scope.hasGlobal(memoHook.name) ||
          hasIdentifier(memoHook.name)
        );
        let memoUsed = false;
        const marker = reactiveProps
          ? program.scope.generateUidIdentifier('markReactiveComponent')
          : undefined;

        // Discover every owner first. Then analyze and instrument in source order,
        // keeping nested consumers isolated and generated identifiers deterministic.
        for (const [owner, calls] of context.owners) {
          const component = prepareComponent(context, owner, calls);
          memoUsed = analyzeAndGuardComponent(component, memoHook) || memoUsed;
          instrumentComponent(component, frameHook);
          if (marker) markComponent(owner, context.imports, marker);
        }
        program.node.body.unshift(
          t.importDeclaration(
            [
              t.importSpecifier(frameHook, t.identifier('useRenderFrame')),
              ...(memoUsed ? [t.importSpecifier(memoHook, t.identifier('useServiceMemo'))] : []),
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
