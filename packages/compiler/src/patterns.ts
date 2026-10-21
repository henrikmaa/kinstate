import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { isHook } from './ast.js';

/** Suspension belongs to its authored function, never a synchronous collector closure. */
function containsSuspension(path: NodePath): boolean {
  if (path.isAwaitExpression() || path.isYieldExpression()) return true;
  let found = false;
  path.traverse({
    Function(nested) {
      nested.skip();
    },
    'AwaitExpression|YieldExpression'(suspension) {
      found = true;
      suspension.stop();
    },
  });
  return found;
}

/** Preserve the original pattern inside collection; expose its bindings in the original scope. */
export function instrumentDestructuring(
  path: NodePath<t.VariableDeclarator>,
  frame: t.Identifier,
  hookNames: ReadonlySet<string>,
  allowFunctionDefaults = false,
): void {
  if (!path.node.init || (!t.isObjectPattern(path.node.id) && !t.isArrayPattern(path.node.id)))
    return;
  if (containsSuspension(path.get('id')))
    throw path.buildCodeFrameError(
      'Await and yield inside destructuring patterns cannot be tracked synchronously. Evaluate computed keys and defaults into local variables before destructuring.',
    );
  path.get('id').traverse({
    AssignmentPattern(pattern) {
      const fallback = pattern.get('right');
      let containsFunction = fallback.isFunction();
      fallback.traverse({
        Function() {
          containsFunction = true;
        },
      });
      if (containsFunction && !allowFunctionDefaults)
        throw fallback.buildCodeFrameError(
          'Function-valued destructuring defaults may capture mutable bindings. Declare the fallback function after destructuring instead.',
        );
    },
  });
  let containsHook = false;
  path.traverse({
    CallExpression(p) {
      if (isHook(p.node.callee, hookNames)) containsHook = true;
    },
  });
  if (containsHook) return;
  const identifiers = Object.keys(t.getBindingIdentifiers(path.node.id));
  const returned = t.objectExpression(
    identifiers.map((name) =>
      t.objectProperty(t.identifier(name), t.identifier(name), false, true),
    ),
  );
  const initializer = path.node.init;
  const suspendedInitializer = containsSuspension(path.get('init') as NodePath<t.Expression>);
  const value = suspendedInitializer ? path.scope.generateUidIdentifier('serviceValue') : null;
  const callback = t.arrowFunctionExpression(
    [],
    t.blockStatement([
      t.variableDeclaration('const', [
        t.variableDeclarator(path.node.id, value ? t.cloneNode(value) : initializer),
      ]),
      t.returnStatement(returned),
    ]),
  );
  path.node.id = t.objectPattern(
    identifiers.map((name) =>
      t.objectProperty(t.identifier(name), t.identifier(name), false, true),
    ),
  );
  path.node.init = t.callExpression(t.memberExpression(t.cloneNode(frame), t.identifier('track')), [
    // The factory evaluates await/yield in the original lexical function, then
    // collects only synchronous destructuring of the resolved value.
    value
      ? t.callExpression(t.arrowFunctionExpression([value], callback), [initializer])
      : callback,
  ]);
  path.skip();
}
