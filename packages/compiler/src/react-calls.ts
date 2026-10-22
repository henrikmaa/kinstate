import * as t from '@babel/types';
import type { NodePath } from '@babel/core';
import type { ComponentContext, ImportBindings } from './context.js';

/** Recognition intentionally matches the import/name policy established during discovery. */
export function isKnownReactHook(
  callee: t.Node,
  context: ComponentContext,
  kind: 'callback' | 'effect' | 'memo',
  scope: NodePath['scope'] = context.owner.scope,
): boolean {
  const imports = context.program.imports;
  const root = t.isIdentifier(callee)
    ? callee
    : t.isMemberExpression(callee) && t.isIdentifier(callee.object)
      ? callee.object
      : undefined;
  if (root) {
    const binding = scope.getBinding(root.name);
    if (binding) {
      const declaration = binding.path.parentPath;
      if (!declaration?.isImportDeclaration() || declaration.node.source.value !== 'react')
        return false;
    }
  }
  const names =
    kind === 'callback'
      ? imports.callbackHooks
      : kind === 'effect'
        ? imports.effectHooks
        : imports.memoHooks;
  if (t.isIdentifier(callee)) return names.has(callee.name);
  return (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object) &&
    imports.reactNamespaces.has(callee.object.name) &&
    t.isIdentifier(callee.property) &&
    (kind === 'callback'
      ? callee.property.name === 'useCallback'
      : kind === 'effect'
        ? /^(useEffect|useLayoutEffect|useInsertionEffect)$/.test(callee.property.name)
        : /^(useMemo|useCallback)$/.test(callee.property.name))
  );
}

export function isElementFactory(
  callee: t.Node,
  context: ComponentContext,
  scope: NodePath['scope'] = context.owner.scope,
): boolean {
  const root = t.isIdentifier(callee)
    ? callee
    : t.isMemberExpression(callee) && t.isIdentifier(callee.object)
      ? callee.object
      : undefined;
  const binding = root && scope.getBinding(root.name);
  if (binding) {
    const declaration = binding.path.parentPath;
    if (
      !declaration?.isImportDeclaration() ||
      !/^react(?:\/jsx-runtime)?$/.test(declaration.node.source.value)
    )
      return false;
  }
  const { elementFactories, reactNamespaces } = context.program.imports;
  return t.isIdentifier(callee)
    ? elementFactories.has(callee.name)
    : t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        reactNamespaces.has(callee.object.name) &&
        t.isIdentifier(callee.property, { name: 'createElement' });
}

export function isComponentWrapper(callee: t.Node, imports: ImportBindings): boolean {
  return t.isIdentifier(callee)
    ? imports.componentWrappers.has(callee.name)
    : t.isMemberExpression(callee) &&
        t.isIdentifier(callee.object) &&
        imports.reactNamespaces.has(callee.object.name) &&
        t.isIdentifier(callee.property) &&
        /^(memo|forwardRef)$/.test(callee.property.name);
}

/** Trust markers require lexical proof of a React import, including shadowing checks. */
export function isImportedComponentWrapper(
  path: NodePath<t.CallExpression>,
  imports: ImportBindings,
): boolean {
  const callee = path.node.callee;
  if (!isComponentWrapper(callee, imports)) return false;
  const root = t.isIdentifier(callee)
    ? callee
    : t.isMemberExpression(callee) && t.isIdentifier(callee.object)
      ? callee.object
      : undefined;
  if (!root) return false;
  const declaration = path.scope.getBinding(root.name)?.path.parentPath;
  return !!declaration?.isImportDeclaration() && declaration.node.source.value === 'react';
}
