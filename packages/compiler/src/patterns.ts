import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { isHook } from './ast.js';

/** Preserve the original pattern inside collection; expose its bindings in the original scope. */
export function instrumentDestructuring(
  path: NodePath<t.VariableDeclarator>,
  frame: t.Identifier,
  hookNames: ReadonlySet<string>,
  allowFunctionDefaults = false,
): void {
  if (!path.node.init || (!t.isObjectPattern(path.node.id) && !t.isArrayPattern(path.node.id)))
    return;
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
  const callback = t.arrowFunctionExpression(
    [],
    t.blockStatement([
      t.variableDeclaration('const', [t.variableDeclarator(path.node.id, path.node.init)]),
      t.returnStatement(returned),
    ]),
  );
  path.node.id = t.objectPattern(
    identifiers.map((name) =>
      t.objectProperty(t.identifier(name), t.identifier(name), false, true),
    ),
  );
  path.node.init = t.callExpression(t.memberExpression(t.cloneNode(frame), t.identifier('track')), [
    callback,
  ]);
  path.skip();
}
