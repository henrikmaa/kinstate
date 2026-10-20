import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { MutableComponentContext } from './context.js';
import { skipNestedConsumer } from './ast.js';

/** Service business methods are ordinary calls even when their names resemble hooks. */
export function normalizeBusinessCalls(context: MutableComponentContext): void {
  const derivedRoot = (node: t.Node): boolean => {
    let root = node;
    while (true) {
      if (t.isMemberExpression(root) || t.isOptionalMemberExpression(root)) root = root.object;
      else if (
        t.isTSAsExpression(root) ||
        t.isTSNonNullExpression(root) ||
        t.isTSTypeAssertion(root) ||
        t.isTSSatisfiesExpression(root) ||
        t.isTSInstantiationExpression(root) ||
        t.isParenthesizedExpression(root)
      )
        root = root.expression;
      else break;
    }
    return t.isIdentifier(root) && context.derivedBindings.has(root.name);
  };
  const methodReference = (path: NodePath, seen = new Set<t.Node>()): boolean => {
    if (seen.has(path.node)) return false;
    seen.add(path.node);
    if (path.isMemberExpression() || path.isOptionalMemberExpression())
      return derivedRoot(path.node);
    if (path.isTSAsExpression() || path.isTSNonNullExpression() || path.isTSTypeAssertion())
      return methodReference(path.get('expression') as NodePath, seen);
    if (path.isIdentifier()) {
      const binding = path.scope.getBinding(path.node.name);
      if (
        !binding?.constant ||
        binding.constantViolations.length ||
        !binding.path.isVariableDeclarator()
      )
        return false;
      const init = binding.path.get('init');
      return !!init.node && methodReference(init as NodePath, seen);
    }
    return false;
  };
  context.owner.traverse({
    Function(path) {
      skipNestedConsumer(path, context);
    },
    VariableDeclarator(path) {
      if (!path.node.init) return;
      const isPattern = t.isObjectPattern(path.node.id) || t.isArrayPattern(path.node.id);
      if (
        !(isPattern ? derivedRoot(path.node.init) : methodReference(path.get('init') as NodePath))
      )
        return;
      for (const previous of Object.keys(t.getBindingIdentifiers(path.node.id))) {
        if (!/^use[A-Z0-9]/.test(previous)) continue;
        const binding = path.scope.getBinding(previous);
        if (!binding) continue;
        if (!binding.constant || binding.constantViolations.length)
          throw path.buildCodeFrameError(
            'Service method aliases whose names start with use must not be reassigned. Use a stable method reference or a name that does not resemble a React hook.',
          );
        const renamed = path.scope.generateUidIdentifier('serviceMethod').name;
        path.scope.rename(previous, renamed);
        context.derivedBindings.add(renamed);
      }
    },
    'CallExpression|OptionalCallExpression'(path) {
      if (!(path.isCallExpression() || path.isOptionalCallExpression())) return;
      const callee = path.node.callee;
      if (
        (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
        t.isIdentifier(callee.property) &&
        !callee.computed &&
        /^use[A-Z0-9]/.test(callee.property.name) &&
        derivedRoot(callee.object)
      ) {
        callee.property = t.stringLiteral(callee.property.name);
        callee.computed = true;
      }
    },
  });
}
