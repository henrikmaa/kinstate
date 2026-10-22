import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ComponentContext } from './context.js';

/** Only a stable binding created by React's actual useRef owns this storage. */
export function isReactRefWrite(
  path: NodePath<t.AssignmentExpression>,
  context: ComponentContext,
): boolean {
  const target = path.get('left');
  if (!target.isMemberExpression()) return false;
  return isRefValue(target, context);
}

/** Follow stable aliases and native descendants of a React ref value. */
function isRefValue(path: NodePath, context: ComponentContext, seen = new Set<t.Node>()): boolean {
  if (seen.has(path.node)) return false;
  seen.add(path.node);
  if (path.isMemberExpression()) {
    const object = path.get('object') as NodePath;
    if (
      !path.node.computed &&
      t.isIdentifier(path.node.property, { name: 'current' }) &&
      object.isIdentifier() &&
      isRefBinding(object, context)
    )
      return true;
    return isRefValue(object, context, seen);
  }
  if (!path.isIdentifier()) return false;
  const binding = path.scope.getBinding(path.node.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) return false;
  const init = binding.path.get('init');
  return !!init.node && isRefValue(init as NodePath, context, seen);
}

function isRefBinding(path: NodePath<t.Identifier>, context: ComponentContext): boolean {
  const binding = path.scope.getBinding(path.node.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) return false;
  let scope = binding.scope;
  while (scope && scope !== context.owner.scope) scope = scope.parent!;
  if (scope !== context.owner.scope) return false;
  const init = binding.path.node.init;
  if (!t.isCallExpression(init)) return false;
  const callee = init.callee;
  const imported = t.isIdentifier(callee)
    ? binding.scope.getBinding(callee.name)
    : t.isMemberExpression(callee) &&
        !callee.computed &&
        t.isIdentifier(callee.property, { name: 'useRef' }) &&
        t.isIdentifier(callee.object)
      ? binding.scope.getBinding(callee.object.name)
      : undefined;
  if (
    !imported?.path.parentPath?.isImportDeclaration() ||
    imported.path.parentPath.node.source.value !== 'react'
  )
    return false;
  return t.isIdentifier(callee)
    ? imported.path.isImportSpecifier() &&
        t.isIdentifier(imported.path.node.imported, { name: 'useRef' })
    : imported.path.isImportDefaultSpecifier() || imported.path.isImportNamespaceSpecifier();
}
