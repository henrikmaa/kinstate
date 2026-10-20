import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ConsumerOwners, ProgramContext } from './context.js';
import { collectImports } from './imports.js';
import { discoverPropComponents } from './prop-components.js';

/** Discover all consumers before changing any function body. */
export function discoverProgram(
  program: NodePath<t.Program>,
  source: string,
  reactiveProps = false,
): ProgramContext | undefined {
  const imports = collectImports(program, source);
  const { services, namespaceImports } = imports;
  if (!services.size && !namespaceImports.size && !reactiveProps) return;
  const isServiceCall = (node: t.CallExpression): boolean =>
    (t.isIdentifier(node.callee) && services.has(node.callee.name)) ||
    (t.isMemberExpression(node.callee) &&
      t.isIdentifier(node.callee.object) &&
      namespaceImports.has(node.callee.object.name) &&
      t.isIdentifier(node.callee.property, { name: 'useService' }));
  const owners: ConsumerOwners = new Map();
  program.traverse({
    CallExpression(path) {
      if (!isServiceCall(path.node)) return;
      const callee = path.node.callee;
      const importedName = t.isIdentifier(callee)
        ? callee.name
        : t.isMemberExpression(callee) && t.isIdentifier(callee.object)
          ? callee.object.name
          : undefined;
      if (
        !importedName ||
        path.scope.getBinding(importedName) !== program.scope.getBinding(importedName)
      )
        return;
      const owner = path.getFunctionParent();
      if (!owner)
        throw path.buildCodeFrameError('useService must be called inside a function component.');
      const calls = owners.get(owner) ?? [];
      calls.push(path);
      owners.set(owner, calls);
    },
  });
  if (reactiveProps) discoverPropComponents(program, owners, imports);
  if (!owners.size) return;

  return {
    reactiveProps,
    program,
    imports,
    owners,
  };
}
