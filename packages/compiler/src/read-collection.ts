import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { isHook } from './ast.js';
import type { ComponentContext } from './context.js';

export type WrapRead = (path: NodePath<t.Expression>) => void;

/** A collector callback never contains hooks or crosses an asynchronous boundary. */
export function createReadWrapper(context: ComponentContext, generated: WeakSet<t.Node>): WrapRead {
  const { frame, derivedBindings } = context;
  const { hookNames } = context.program.imports;
  return (path: NodePath<t.Expression>): void => {
    if (generated.has(path.node)) return;
    let unsafe = false;
    path.traverse({
      AwaitExpression(p) {
        unsafe = true;
        p.stop();
      },
      YieldExpression(p) {
        unsafe = true;
        p.stop();
      },
      CallExpression(p) {
        if (isHook(p.node.callee, hookNames)) {
          unsafe = true;
          p.stop();
        }
      },
    });
    if (unsafe) {
      let reactive = false;
      path.traverse({
        ReferencedIdentifier(ref) {
          if (derivedBindings.has(ref.node.name)) reactive = true;
        },
      });
      if (reactive)
        throw path.buildCodeFrameError(
          'A hook, await, or yield cannot be nested inside a reactive read. Evaluate it into a local variable before calling the service or reading derived values.',
        );
      return;
    }
    const replacement = t.callExpression(
      t.memberExpression(t.cloneNode(frame), t.identifier('track')),
      [t.arrowFunctionExpression([], path.node)],
    );
    generated.add(replacement);
    path.replaceWith(replacement);
    path.skip();
  };
}

/** Type-only expressions preserve references; parentheses delimit optional chains. */
function isTypeWrapper(path: NodePath): boolean {
  return (
    path.isTSAsExpression() ||
    path.isTSTypeAssertion() ||
    path.isTSNonNullExpression() ||
    path.isTSSatisfiesExpression() ||
    path.isTSInstantiationExpression()
  );
}

/** A chain's backbone is collected only by its outermost expression. */
export function chainContinues(path: NodePath): boolean {
  let current = path;
  while (
    !current.node.extra?.parenthesized &&
    current.parentPath &&
    isTypeWrapper(current.parentPath)
  )
    current = current.parentPath;
  if (current.node.extra?.parenthesized) return false;
  const parent = current.parentPath;
  return (
    !!parent &&
    ((parent.isOptionalMemberExpression() && parent.node.object === current.node) ||
      (parent.isOptionalCallExpression() && parent.node.callee === current.node))
  );
}

/** Wrapping a callee/tag separately would erase its receiver. Delete needs its reference too. */
export function isReferenceOperand(path: NodePath): boolean {
  let current = path;
  while (
    current.parentPath &&
    (isTypeWrapper(current.parentPath) || current.parentPath.isParenthesizedExpression())
  )
    current = current.parentPath;
  const parent = current.parentPath;
  return (
    !!parent &&
    (((parent.isCallExpression() ||
      parent.isOptionalCallExpression() ||
      parent.isNewExpression()) &&
      parent.node.callee === current.node) ||
      (parent.isTaggedTemplateExpression() && parent.node.tag === current.node) ||
      parent.isUnaryExpression({ operator: 'delete' }))
  );
}
