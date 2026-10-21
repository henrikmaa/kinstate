import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ComponentContext } from './context.js';
import { isKnownReactHook } from './react-calls.js';

function isStableHookDependency(ref: NodePath, context: ComponentContext): boolean {
  const array = ref.parentPath;
  const call = array?.parentPath;
  return (
    !!array?.isArrayExpression() &&
    !!call?.isCallExpression() &&
    call.node.arguments[1] === array.node &&
    (isKnownReactHook(call.node.callee, context, 'effect', ref.scope) ||
      isKnownReactHook(call.node.callee, context, 'memo', ref.scope))
  );
}

export function validateServiceReferences(context: ComponentContext): void {
  const { owner, serviceBindings } = context;
  for (const bindingName of serviceBindings) {
    const binding = owner.scope.getBinding(bindingName);
    if (!binding) continue;
    if (binding.constantViolations.length)
      throw binding.constantViolations[0]!.buildCodeFrameError(
        'Service bindings must not be reassigned.',
      );
    for (const ref of binding.referencePaths) {
      const parent = ref.parentPath;
      if (!parent) continue;
      if (
        (parent.isMemberExpression() || parent.isOptionalMemberExpression()) &&
        parent.node.object === ref.node
      )
        continue;
      if (parent.isVariableDeclarator() && parent.node.init === ref.node) continue;
      if (
        context.program.reactiveProps &&
        parent.isJSXExpressionContainer() &&
        (parent.parentPath.isJSXAttribute() || parent.parentPath.isJSXElement())
      )
        continue;
      if (isStableHookDependency(ref, context)) continue;
      if (parent.isUnaryExpression({ operator: 'typeof' })) continue;
      if (
        parent.isBinaryExpression() &&
        ['===', '!==', '==', '!=', 'instanceof', 'in'].includes(parent.node.operator)
      )
        continue;
      if (parent.isSpreadElement()) continue;
      if (
        (parent.isForInStatement() || parent.isForOfStatement()) &&
        parent.node.right === ref.node
      )
        continue;
      if (
        parent.isCallExpression() &&
        t.isMemberExpression(parent.node.callee) &&
        t.isIdentifier(parent.node.callee.object, { name: 'Object' }) &&
        t.isIdentifier(parent.node.callee.property) &&
        ['keys', 'values', 'entries', 'is'].includes(parent.node.callee.property.name)
      )
        continue;
      throw ref.buildCodeFrameError(
        'A service cannot escape to an external helper, JSX prop, or return value. Read its properties in the component, or call useService in the receiving component.',
      );
    }
  }
}

/** Read-only validation; boundary rewrites for this call must already be installed. */
export function validateMemoCall(
  path: NodePath<t.CallExpression>,
  context: ComponentContext,
): void {
  const { serviceBindings, derivedBindings } = context;
  const callee = path.node.callee;
  if (
    !isKnownReactHook(callee, context, 'memo', path.scope) ||
    isKnownReactHook(callee, context, 'callback', path.scope)
  )
    return;
  const callback = path.get('arguments')[0];
  if (!callback) return;
  let readsService = callback.isIdentifier() && derivedBindings.has(callback.node.name);
  callback.traverse({
    ReferencedIdentifier(ref) {
      let parent = ref.parentPath;
      while (
        parent.isTSAsExpression() ||
        parent.isTSTypeAssertion() ||
        parent.isTSNonNullExpression() ||
        parent.isTSSatisfiesExpression() ||
        parent.isTSInstantiationExpression() ||
        parent.isParenthesizedExpression()
      )
        parent = parent.parentPath;
      if (
        serviceBindings.has(ref.node.name) ||
        (derivedBindings.has(ref.node.name) &&
          (parent.isMemberExpression() ||
            parent.isOptionalMemberExpression() ||
            parent.isCallExpression() ||
            parent.isOptionalCallExpression() ||
            parent.isNewExpression()))
      )
        readsService = true;
    },
  });
  if (readsService)
    throw path.buildCodeFrameError(
      'useMemo must not hide reactive service reads. Read the required primitive values before the hook and include them in its dependencies.',
    );
}
