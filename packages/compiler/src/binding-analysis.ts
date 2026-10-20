import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { skipNestedConsumer } from './ast.js';
import type { ComponentContext, MutableComponentContext } from './context.js';

/** Grow binding facts to a fixed point without rewriting AST nodes. Diagnostics preserve source traversal order. */
export function collectServiceAliases(context: MutableComponentContext): void {
  const { owner, serviceBindings } = context;
  // Follow simple aliases, so diagnostics cannot be bypassed by renaming a service.
  let changed = true;
  while (changed) {
    changed = false;
    owner.traverse({
      Function(path) {
        skipNestedConsumer(path, context);
      },
      VariableDeclarator(path) {
        if (
          t.isIdentifier(path.node.init) &&
          serviceBindings.has(path.node.init.name) &&
          t.isIdentifier(path.node.id) &&
          !serviceBindings.has(path.node.id.name)
        ) {
          serviceBindings.add(path.node.id.name);
          changed = true;
        }
      },
    });
  }
}

export function collectDerivedBindings(context: MutableComponentContext): void {
  const { owner, serviceBindings, derivedBindings } = context;
  for (const name of serviceBindings) derivedBindings.add(name);
  let derivedChanged = true;
  while (derivedChanged) {
    derivedChanged = false;
    owner.traverse({
      Function(path) {
        skipNestedConsumer(path, context);
      },
      FunctionDeclaration(path) {
        if (!path.node.id || !referencesDerived(path, context)) return;
        if (!derivedBindings.has(path.node.id.name)) {
          derivedBindings.add(path.node.id.name);
          derivedChanged = true;
        }
      },
      VariableDeclarator(path) {
        const init = path.get('init');
        if (!init.node) return;
        let derived = init.isIdentifier() && derivedBindings.has(init.node.name);
        init.traverse({
          ReferencedIdentifier(ref) {
            if (derivedBindings.has(ref.node.name)) derived = true;
          },
        });
        if (derived)
          for (const name of Object.keys(t.getBindingIdentifiers(path.node.id))) {
            if (!derivedBindings.has(name)) {
              derivedBindings.add(name);
              derivedChanged = true;
            }
          }
      },
      AssignmentExpression(path) {
        const right = path.get('right');
        let derived = right.isIdentifier() && derivedBindings.has(right.node.name);
        right.traverse({
          ReferencedIdentifier(ref) {
            if (derivedBindings.has(ref.node.name)) derived = true;
          },
        });
        if (!derived) return;
        if (
          !t.isIdentifier(path.node.left) &&
          !t.isObjectPattern(path.node.left) &&
          !t.isArrayPattern(path.node.left)
        ) {
          let target: t.Node = path.node.left;
          while (t.isMemberExpression(target) || t.isOptionalMemberExpression(target))
            target = target.object;
          if (t.isIdentifier(target) && derivedBindings.has(target.name)) return;
          throw path.buildCodeFrameError(
            'Reactive-derived values cannot escape through property assignment. Keep them in a local binding and resolve services in consuming components.',
          );
        }
        for (const name of Object.keys(t.getBindingIdentifiers(path.node.left))) {
          let bindingScope = path.scope.getBinding(name)?.scope;
          while (bindingScope && bindingScope !== owner.scope) bindingScope = bindingScope.parent;
          if (!bindingScope)
            throw path.buildCodeFrameError(
              'Reactive-derived values cannot be assigned outside the consuming component. Keep service state within its owning scope.',
            );
          if (!derivedBindings.has(name)) {
            derivedBindings.add(name);
            derivedChanged = true;
          }
        }
      },
    });
  }
}

export function referencesDerived(path: NodePath, context: ComponentContext): boolean {
  let derived = path.isIdentifier() && context.derivedBindings.has(path.node.name);
  path.traverse({
    ReferencedIdentifier(ref) {
      if (context.derivedBindings.has(ref.node.name)) derived = true;
    },
  });
  return derived;
}
