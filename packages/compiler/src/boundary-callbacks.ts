import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ComponentContext } from './context.js';
import { referencesDerived } from './binding-analysis.js';
import { isKnownReactHook } from './react-calls.js';
import { isHook } from './ast.js';

type Binding = NonNullable<ReturnType<NodePath['scope']['getBinding']>>;

/** Follow local helper captures so certifying one alias cannot conceal live service reads. */
function capturesLiveService(
  binding: Binding,
  context: ComponentContext,
  seen = new Set<Binding>(),
): boolean {
  if (!(
    binding.path.isFunctionDeclaration() ||
    (binding.path.isVariableDeclarator() && t.isFunction(binding.path.node.init))
  ))
    return false;
  if (seen.has(binding)) return false;
  seen.add(binding);
  let live = false;
  binding.path.traverse({
    ReferencedIdentifier(ref) {
      if (!context.derivedBindings.has(ref.node.name)) return;
      const captured = ref.scope.getBinding(ref.node.name);
      if (!captured || captured === binding) return;
      if (context.serviceBindings.has(ref.node.name)) live = true;
      else if (
        captured.path.isFunctionDeclaration() ||
        (captured.path.isVariableDeclarator() && t.isFunction(captured.path.node.init))
      )
        live ||= capturesLiveService(captured, context, seen);
    },
  });
  return live;
}

function capturesDeferred(binding: Binding, seen = new Set<Binding>()): boolean {
  if (seen.has(binding)) return false;
  seen.add(binding);
  const fn = binding.path.isFunctionDeclaration()
    ? binding.path
    : binding.path.isVariableDeclarator() && t.isFunction(binding.path.node.init)
      ? (binding.path.get('init') as NodePath<t.Function>)
      : undefined;
  if (!fn) {
    if (
      !binding.path.isVariableDeclarator() ||
      !binding.constant ||
      binding.constantViolations.length
    )
      return false;
    let value = binding.path.get('init') as NodePath;
    while (
      value.isTSAsExpression() ||
      value.isTSNonNullExpression() ||
      value.isTSSatisfiesExpression() ||
      value.isTSTypeAssertion() ||
      value.isParenthesizedExpression()
    )
      value = value.get('expression') as NodePath;
    if (!value.isIdentifier()) return false;
    const alias = value.scope.getBinding(value.node.name);
    return !!alias && capturesDeferred(alias, seen);
  }
  if (fn.node.async || fn.node.generator) return true;
  let deferred = false;
  fn.traverse({
    ReferencedIdentifier(ref) {
      const captured = ref.scope.getBinding(ref.node.name);
      if (captured && captured !== binding) deferred ||= capturesDeferred(captured, seen);
    },
  });
  return deferred;
}

function isLocalCapture(binding: Binding | undefined, context: ComponentContext): boolean {
  let scope = binding?.scope;
  while (scope && scope !== context.owner.scope) scope = scope.parent;
  return scope === context.owner.scope;
}

/** Hook outputs without service inputs remain ordinary external commands. */
function isUnrelatedHookBinding(binding: Binding, context: ComponentContext): boolean {
  if (
    context.derivedBindings.has(binding.identifier.name) ||
    !binding.constant ||
    binding.constantViolations.length ||
    !binding.path.isVariableDeclarator()
  )
    return false;
  const init = binding.path.get('init');
  return (
    init.isCallExpression() &&
    isHook(init.node.callee, context.program.imports.hookNames) &&
    !referencesDerived(init, context)
  );
}

/** Certificates describe captures, not callback behavior. No callback is evaluated. */
export function certifyBoundaryCallbacks(
  path: NodePath,
  context: ComponentContext,
  seen = new Set<Binding>(),
): boolean {
  const certify = (
    target: NodePath,
    captures: t.Expression[],
    mandatory?: boolean,
    blocked = false,
  ): boolean => {
    if (!target.isExpression()) return false;
    target.replaceWith(
      t.callExpression(t.memberExpression(t.cloneNode(context.frame), t.identifier('callback')), [
        target.node,
        t.arrowFunctionExpression([], t.arrayExpression(captures)),
        t.booleanLiteral(
          mandatory ?? (target.isFunction() && !!(target.node.async || target.node.generator)),
        ),
        t.booleanLiteral(blocked),
      ]),
    );
    target.skip();
    return true;
  };
  if (
    path.isTSAsExpression() ||
    path.isTSNonNullExpression() ||
    path.isTSTypeAssertion() ||
    path.isTSSatisfiesExpression() ||
    path.isParenthesizedExpression()
  )
    return certifyBoundaryCallbacks(path.get('expression') as NodePath, context, seen);
  if (path.isFunction()) {
    const captures = new Map<Binding, t.Expression>();
    let safe = true;
    let deferredCapture = false;
    path.traverse({
      ReferencedIdentifier(ref) {
        const binding = ref.scope.getBinding(ref.node.name);
        if (!context.derivedBindings.has(ref.node.name) && !isLocalCapture(binding, context))
          return;
        // References owned by this callback (including parameters) are not captures.
        if (!binding) {
          safe = false;
          return;
        }
        let scope = binding.scope;
        while (scope && scope !== path.scope) scope = scope.parent!;
        if (scope === path.scope) return;
        if (isUnrelatedHookBinding(binding, context)) return;
        if (
          context.serviceBindings.has(ref.node.name) ||
          !binding.constant ||
          binding.constantViolations.length ||
          capturesLiveService(binding, context)
        ) {
          safe = false;
          deferredCapture ||= capturesDeferred(binding);
          return;
        }
        deferredCapture ||= capturesDeferred(binding);
        captures.set(binding, t.identifier(ref.node.name));
      },
      Super() {
        safe = false;
      },
    });
    const deferred = !!(path.node.async || path.node.generator || deferredCapture);
    if (!safe && !deferred) return false;
    if (path.isObjectMethod()) {
      if (path.node.kind !== 'method') return false;
      const original = path.node;
      // Extract a genuine method rather than converting it to a constructible function.
      // The enclosing computed key still evaluates exactly once, in its original position.
      const method = t.cloneNode(original, true);
      method.key = original.computed ? t.identifier('callback') : t.cloneNode(original.key);
      method.computed = false;
      const key = t.isIdentifier(method.key)
        ? t.stringLiteral(method.key.name)
        : (t.cloneNode(method.key) as t.Expression);
      const fn = t.memberExpression(t.objectExpression([method]), key, true);
      path.replaceWith(t.objectProperty(original.key, fn, original.computed));
      return certify(path.get('value') as NodePath, [...captures.values()], deferred, !safe);
    }
    return certify(path, [...captures.values()], deferred, !safe) && safe;
  }
  if (path.isIdentifier()) {
    const binding = path.scope.getBinding(path.node.name);
    if (!context.derivedBindings.has(path.node.name) && !isLocalCapture(binding, context))
      return certify(path, []);
    if (!binding || seen.has(binding) || !binding.constant || binding.constantViolations.length)
      return false;
    const next = new Set(seen).add(binding);
    if (binding.path.isVariableDeclarator()) {
      const init = binding.path.get('init');
      if (isUnrelatedHookBinding(binding, context)) return certify(path, []);
      return !!init.node && certifyBoundaryCallbacks(init as NodePath, context, next);
    }
    if (binding.path.isFunctionDeclaration()) {
      // Preserve declaration hoisting and identity; certify its reference instead.
      const declaration = binding.path;
      const captures = new Map<Binding, t.Expression>();
      let safe = true;
      let deferredCapture = false;
      declaration.traverse({
        ReferencedIdentifier(ref) {
          const captured = ref.scope.getBinding(ref.node.name);
          if (
            (!context.derivedBindings.has(ref.node.name) && !isLocalCapture(captured, context)) ||
            ref.node.name === path.node.name
          )
            return;
          if (captured) {
            deferredCapture ||= capturesDeferred(captured);
            let scope = captured.scope;
            while (scope && scope !== declaration.scope) scope = scope.parent!;
            if (scope === declaration.scope) return;
            if (isUnrelatedHookBinding(captured, context)) return;
          }
          if (
            !captured ||
            context.serviceBindings.has(ref.node.name) ||
            !captured.constant ||
            captured.constantViolations.length ||
            capturesLiveService(captured, context)
          )
            safe = false;
          else captures.set(captured, t.identifier(ref.node.name));
        },
      });
      const deferred = !!(declaration.node.async || declaration.node.generator || deferredCapture);
      if (!safe && !deferred) return false;
      for (const capture of captures.keys()) {
        if (path.scope.getBinding(capture.identifier.name) !== capture) {
          if (deferred) certify(path, [], true, true);
          return false;
        }
      }
      return certify(path, [...captures.values()], deferred, !safe) && safe;
    }
    return false;
  }
  if (path.isCallExpression()) {
    const callback = path.get('arguments')[0];
    if (isKnownReactHook(path.node.callee, context, 'callback', path.scope))
      return !!callback && certifyBoundaryCallbacks(callback as NodePath, context, seen);
    if (callback?.isFunction() && isKnownReactHook(path.node.callee, context, 'memo', path.scope)) {
      // Only certify explicit results of React's known memo hook. The memo callback
      // itself runs during rendering; its existing hidden-read validation still applies.
      const body = callback.get('body');
      if (!body.isBlockStatement())
        return certifyBoundaryCallbacks(body as NodePath, context, seen);
      body.traverse({
        Function(nested) {
          nested.skip();
        },
        ReturnStatement(returned) {
          const value = returned.get('argument');
          if (value.node) certifyBoundaryCallbacks(value as NodePath, context, seen);
        },
      });
    }
  }
  if (path.isObjectExpression()) {
    for (const property of path.get('properties')) {
      if (property.isObjectProperty())
        certifyBoundaryCallbacks(property.get('value') as NodePath, context, seen);
      else if (property.isObjectMethod()) certifyBoundaryCallbacks(property, context, seen);
      else if (property.isSpreadElement())
        certifyBoundaryCallbacks(property.get('argument'), context, seen);
    }
  } else if (path.isArrayExpression()) {
    for (const element of path.get('elements'))
      if (element.node) certifyBoundaryCallbacks(element as NodePath, context, seen);
  } else if (path.isConditionalExpression()) {
    certifyBoundaryCallbacks(path.get('consequent'), context, seen);
    certifyBoundaryCallbacks(path.get('alternate'), context, seen);
  } else if (path.isLogicalExpression()) {
    certifyBoundaryCallbacks(path.get('left'), context, seen);
    certifyBoundaryCallbacks(path.get('right'), context, seen);
  }
  // Opaque factories receiving derived data may return live closures. Never certify them.
  return false;
}
