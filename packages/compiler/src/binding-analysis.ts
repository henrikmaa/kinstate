import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { skipNestedConsumer } from './ast.js';
import type { ComponentContext, MutableComponentContext } from './context.js';
import { isKnownReactHook } from './react-calls.js';
import { isReactRefWrite } from './react-refs.js';

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
      'FunctionDeclaration|ClassDeclaration'(path) {
        if (!(path.isFunctionDeclaration() || path.isClassDeclaration())) return;
        if (!path.node.id || !referencesDerived(path, context)) return;
        if (!derivedBindings.has(path.node.id.name)) {
          derivedBindings.add(path.node.id.name);
          derivedChanged = true;
        }
      },
      VariableDeclarator(path) {
        const init = path.get('init');
        if (!init.node || isNativeScalarResult(init as NodePath)) return;
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
      'CallExpression|OptionalCallExpression'(path) {
        if (!(path.isCallExpression() || path.isOptionalCallExpression())) return;
        // React owns each hook argument separately; a callback capture cannot
        // mutate the dependency array or unrelated sibling inputs through React.
        if (
          isKnownReactHook(path.node.callee, context, 'memo', path.scope) ||
          isKnownReactHook(path.node.callee, context, 'effect', path.scope)
        )
          return;
        // Calls may store a derived argument in another argument or receiver
        // (push/splice, Object.assign, or a user helper). Carry provenance to
        // component-local aliases without claiming to know the callee's effects.
        const arguments_ = path.get('arguments') as NodePath[];
        if (!arguments_.some((argument) => referencesDerived(argument, context))) return;
        const taint = (reference: NodePath<t.Identifier | t.JSXIdentifier>) => {
          const binding = reference.scope.getBinding(reference.node.name);
          let scope = binding?.scope;
          while (scope && scope !== owner.scope) scope = scope.parent;
          if (!scope || derivedBindings.has(reference.node.name)) return;
          derivedBindings.add(reference.node.name);
          derivedChanged = true;
        };
        const callee = path.get('callee') as NodePath;
        if (callee.isMemberExpression() || callee.isOptionalMemberExpression()) {
          let receiver = callee.get('object') as NodePath;
          while (receiver.isMemberExpression() || receiver.isOptionalMemberExpression())
            receiver = receiver.get('object') as NodePath;
          if (receiver.isReferencedIdentifier()) taint(receiver);
        }
        for (const argument of arguments_) {
          if (argument.isReferencedIdentifier()) taint(argument);
          argument.traverse({ ReferencedIdentifier: taint });
        }
      },
      AssignmentExpression(path) {
        if (isLocalNativeCommand(path, context)) return;
        const right = path.get('right');
        if (isNativeScalarResult(right)) return;
        let derived = right.isIdentifier() && derivedBindings.has(right.node.name);
        right.traverse({
          ReferencedIdentifier(ref) {
            if (derivedBindings.has(ref.node.name)) derived = true;
          },
        });
        if (!derived || isReactRefWrite(path, context)) return;
        if (
          !t.isIdentifier(path.node.left) &&
          !t.isObjectPattern(path.node.left) &&
          !t.isArrayPattern(path.node.left)
        ) {
          let target: t.Node = path.node.left;
          while (t.isMemberExpression(target) || t.isOptionalMemberExpression(target))
            target = target.object;
          if (t.isIdentifier(target)) {
            if (derivedBindings.has(target.name)) return;
            const binding = path.scope.getBinding(target.name);
            // Fresh payloads allocated within one callback are authored data,
            // not external storage. Propagate provenance so later boundaries
            // still validate any reactive values placed into that payload.
            if (
              binding?.constant &&
              !binding.constantViolations.length &&
              binding.path.isVariableDeclarator() &&
              (t.isObjectExpression(binding.path.node.init) ||
                t.isArrayExpression(binding.path.node.init)) &&
              binding.scope !== owner.scope &&
              binding.scope.getFunctionParent() === path.scope.getFunctionParent()
            ) {
              derivedBindings.add(target.name);
              derivedChanged = true;
              return;
            }
          }
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

/** Native event properties are command registration, never render-data escapes. */
function isLocalNativeCommand(
  path: NodePath<t.AssignmentExpression>,
  context: ComponentContext,
): boolean {
  const left = path.get('left');
  if (
    !left.isMemberExpression() ||
    left.node.computed ||
    !t.isIdentifier(left.node.property) ||
    !/^on[a-z]+$/.test(left.node.property.name) ||
    !t.isIdentifier(left.node.object)
  )
    return false;
  const binding = path.scope.getBinding(left.node.object.name);
  if (!binding?.constant || !binding.path.isVariableDeclarator()) return false;
  let scope = binding.scope;
  while (scope && scope !== context.owner.scope) scope = scope.parent!;
  if (scope !== context.owner.scope) return false;
  const init = binding.path.node.init;
  if (
    t.isNewExpression(init) &&
    t.isIdentifier(init.callee, { name: 'FileReader' }) &&
    !binding.scope.getBinding('FileReader')
  )
    return true;
  return (
    t.isCallExpression(init) &&
    t.isMemberExpression(init.callee) &&
    t.isIdentifier(init.callee.object, { name: 'document' }) &&
    !binding.scope.getBinding('document') &&
    !init.callee.computed &&
    t.isIdentifier(init.callee.property, { name: 'createElement' })
  );
}

/** Browser animation scheduler handles are numbers, not escaped callback objects. */
function isNativeScalarResult(path: NodePath): boolean {
  return (
    path.isCallExpression() &&
    t.isIdentifier(path.node.callee, { name: 'requestAnimationFrame' }) &&
    !path.scope.getBinding('requestAnimationFrame')
  );
}
