import type { NodePath } from '@babel/core';
import * as t from '@babel/types';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

/** Only React's second tuple item is an inert dispatch capability, regardless of initial data. */
export function isReactStateSetter(binding: Binding, seen = new Set<Binding>()): boolean {
  if (!binding.constant || binding.constantViolations.length || seen.has(binding)) return false;
  seen.add(binding);
  if (!binding.path.isVariableDeclarator()) return false;
  let value = binding.path.get('init') as NodePath;
  while (
    value.isTSAsExpression() ||
    value.isTSNonNullExpression() ||
    value.isTSSatisfiesExpression() ||
    value.isTSTypeAssertion() ||
    value.isParenthesizedExpression()
  )
    value = value.get('expression') as NodePath;
  if (t.isIdentifier(binding.path.node.id) && value.isIdentifier()) {
    const original = value.scope.getBinding(value.node.name);
    return !!original && isReactStateSetter(original, seen);
  }
  const pattern = binding.path.node.id;
  if (
    !t.isArrayPattern(pattern) ||
    pattern.elements[1] !== binding.identifier ||
    !value.isCallExpression()
  )
    return false;
  const callee = value.node.callee;
  const root = t.isIdentifier(callee)
    ? callee
    : t.isMemberExpression(callee) && t.isIdentifier(callee.object)
      ? callee.object
      : undefined;
  const imported = root && value.scope.getBinding(root.name)?.path;
  if (!imported?.parentPath?.isImportDeclaration()) return false;
  if (imported.parentPath.node.source.value !== 'react') return false;
  if (t.isIdentifier(callee) && imported.isImportSpecifier()) {
    const name = imported.node.imported;
    return /^(useState|useReducer)$/.test(t.isIdentifier(name) ? name.name : name.value);
  }
  return (
    t.isMemberExpression(callee) &&
    (imported.isImportNamespaceSpecifier() || imported.isImportDefaultSpecifier()) &&
    (callee.computed
      ? t.isStringLiteral(callee.property) && /^(useState|useReducer)$/.test(callee.property.value)
      : t.isIdentifier(callee.property) && /^(useState|useReducer)$/.test(callee.property.name))
  );
}
