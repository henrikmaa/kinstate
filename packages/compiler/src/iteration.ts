import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { isHook } from './ast.js';
import { instrumentDestructuring } from './patterns.js';
import type { WrapRead } from './read-collection.js';

/** Keep the loop itself intact so labels, break, continue and iterator closing stay native. */
export function instrumentForOf(
  path: NodePath<t.ForOfStatement>,
  frame: t.Identifier,
  hookNames: ReadonlySet<string>,
  wrap: WrapRead,
): void {
  if (path.node.await) return;
  const left = path.get('left');
  const declaration = left.isVariableDeclaration() ? left.node : undefined;
  const pattern = declaration?.declarations[0]?.id ?? left.node;
  if (t.isObjectPattern(pattern) || t.isArrayPattern(pattern)) {
    const names = new Set(Object.keys(t.getBindingIdentifiers(pattern)));
    validateLoopPattern(path, left, declaration, names, hookNames);
    const item = path.scope.generateUidIdentifier('serviceItem');
    const originalBody = path.node.body;
    path.node.left = t.variableDeclaration(declaration?.kind ?? 'const', [
      t.variableDeclarator(t.cloneNode(item)),
    ]);
    if (!declaration || declaration.kind === 'var') {
      const statements: t.Statement[] = [];
      if (declaration && names.size)
        statements.push(
          t.variableDeclaration(
            'var',
            [...names].map((name) => t.variableDeclarator(t.identifier(name))),
          ),
        );
      statements.push(
        t.expressionStatement(t.assignmentExpression('=', pattern, t.cloneNode(item))),
      );
      path.node.body = t.blockStatement([...statements, originalBody]);
      const body = path.get('body') as NodePath<t.BlockStatement>;
      const assignment = body.get('body')[
        statements.length - 1
      ]! as NodePath<t.ExpressionStatement>;
      wrap(assignment.get('expression'));
    } else {
      const binding = t.variableDeclaration(declaration.kind, [
        t.variableDeclarator(pattern, t.cloneNode(item)),
      ]);
      // The original body remains a separate scope; it may shadow a header binding.
      path.node.body = t.blockStatement([binding, originalBody]);
      const body = path.get('body') as NodePath<t.BlockStatement>;
      const bindingPath = body.get('body')[0]! as NodePath<t.VariableDeclaration>;
      instrumentDestructuring(bindingPath.get('declarations')[0]!, frame, hookNames, true);
    }
    // Lowering introduces bindings. Refresh Babel scope data before later exit visitors run.
    path.scope.crawl();
  }
  path.node.right = t.callExpression(
    t.memberExpression(t.cloneNode(frame), t.identifier('iterate')),
    [path.node.right],
  );
}

/** Reject cases whose lexical or Hook semantics cannot survive header lowering. */
function validateLoopPattern(
  path: NodePath<t.ForOfStatement>,
  left: NodePath<t.ForOfStatement['left']>,
  declaration: t.VariableDeclaration | undefined,
  names: ReadonlySet<string>,
  hookNames: ReadonlySet<string>,
): void {
  const lexical = declaration && declaration.kind !== 'var';
  const headerBindings = new Map([...names].map((name) => [name, path.scope.getBinding(name)]));
  const referencesHeader = (ref: NodePath<t.Identifier | t.JSXIdentifier>) =>
    names.has(ref.node.name) &&
    ref.scope.getBinding(ref.node.name) === headerBindings.get(ref.node.name);
  const leftPattern = declaration
    ? (left.get('declarations') as NodePath<t.VariableDeclarator>[])[0]!.get('id')
    : left;
  let containsHook = false;
  let capturesMutableBinding = false;
  leftPattern.traverse({
    CallExpression(call) {
      if (isHook(call.node.callee, hookNames)) containsHook = true;
    },
    Function(fn) {
      if (declaration?.kind !== 'let') return;
      fn.traverse({
        ReferencedIdentifier(ref) {
          if (referencesHeader(ref) && !headerBindings.get(ref.node.name)?.constant)
            capturesMutableBinding = true;
        },
      });
    },
  });
  if (containsHook)
    throw path.buildCodeFrameError(
      'Hooks cannot run inside loop destructuring. Evaluate hook results before the loop.',
    );
  if (capturesMutableBinding)
    throw path.buildCodeFrameError(
      'Loop destructuring closures cannot capture mutable let bindings. Declare the callback in the loop body instead.',
    );
  if (lexical) {
    let referencesOwnBinding = false;
    const right = path.get('right');
    if (right.isIdentifier() && referencesHeader(right)) referencesOwnBinding = true;
    right.traverse({
      ReferencedIdentifier(ref) {
        if (referencesHeader(ref)) referencesOwnBinding = true;
      },
    });
    if (referencesOwnBinding)
      throw path.buildCodeFrameError(
        'The loop iterable cannot reference bindings declared by its destructuring header. Evaluate the iterable before the loop.',
      );
  }
}
