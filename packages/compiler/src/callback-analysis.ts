import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ComponentContext } from './context.js';
import { isKnownReactHook } from './react-calls.js';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

/** Resolve callback values without walking deferred bodies or evaluating user code. */
export function hasAsynchronousCallback(
  path: NodePath,
  context: ComponentContext,
  seen = new Set<Binding>(),
): boolean {
  if (path.isFunction()) return !!(path.node.async || path.node.generator);
  if (
    path.isTSAsExpression() ||
    path.isTSNonNullExpression() ||
    path.isTSTypeAssertion() ||
    path.isTSSatisfiesExpression() ||
    path.isParenthesizedExpression()
  )
    return hasAsynchronousCallback(path.get('expression') as NodePath, context, seen);
  if (path.isIdentifier()) {
    const binding = path.scope.getBinding(path.node.name);
    if (!binding || !binding.constant || binding.constantViolations.length || seen.has(binding))
      return false;
    const next = new Set(seen).add(binding);
    if (binding.path.isFunctionDeclaration())
      return hasAsynchronousCallback(binding.path, context, next);
    if (binding.path.isVariableDeclarator()) {
      const value = binding.path.get('init');
      if (value.node) return hasAsynchronousCallback(value as NodePath, context, next);
    }
  }
  if (path.isConditionalExpression())
    return (
      hasAsynchronousCallback(path.get('consequent'), context, seen) ||
      hasAsynchronousCallback(path.get('alternate'), context, seen)
    );
  if (path.isLogicalExpression())
    return (
      hasAsynchronousCallback(path.get('left'), context, seen) ||
      hasAsynchronousCallback(path.get('right'), context, seen)
    );
  if (path.isSequenceExpression()) {
    const expressions = path.get('expressions');
    const result = expressions[expressions.length - 1];
    return !!result && hasAsynchronousCallback(result, context, seen);
  }
  if (
    path.isCallExpression() &&
    isKnownReactHook(path.node.callee, context, 'callback', path.scope)
  ) {
    const callback = path.get('arguments')[0];
    return !!callback && hasAsynchronousCallback(callback, context, seen);
  }
  return false;
}
