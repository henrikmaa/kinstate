import type { NodePath } from '@babel/core';
import * as t from '@babel/types';

import type { ComponentContext } from './context.js';

/** Nested consumers get their own frame; ordinary synchronous callbacks do not. */
export function skipNestedConsumer(path: NodePath<t.Function>, context: ComponentContext): void {
  if (context.program.owners.has(path) && path !== context.owner) path.skip();
}

export function isHook(callee: t.Node, names: ReadonlySet<string> = new Set()): boolean {
  return t.isIdentifier(callee)
    ? names.has(callee.name) || /^use[A-Z0-9]/.test(callee.name)
    : (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
        !callee.computed &&
        t.isIdentifier(callee.property) &&
        /^use[A-Z0-9]/.test(callee.property.name);
}

export function isWriteTarget(path: NodePath): boolean {
  let current: NodePath = path;
  while (
    current.parentPath?.isObjectProperty() ||
    current.parentPath?.isObjectPattern() ||
    current.parentPath?.isArrayPattern() ||
    current.parentPath?.isRestElement()
  )
    current = current.parentPath;
  const parent = current.parentPath;
  return (
    !!parent &&
    ((parent.isAssignmentExpression() && parent.node.left === current.node) ||
      parent.isUpdateExpression() ||
      ((parent.isForInStatement() || parent.isForOfStatement()) &&
        parent.node.left === current.node))
  );
}
