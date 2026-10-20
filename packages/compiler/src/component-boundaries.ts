import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { skipNestedConsumer } from './ast.js';
import type { ComponentContext } from './context.js';
import { referencesDerived } from './binding-analysis.js';
import { isElementFactory, isKnownReactHook } from './react-calls.js';
import { hasAsynchronousCallback } from './callback-analysis.js';

/** A receiver is evaluated twice by JSX lowering; only immutable lexical bindings are safe. */
function stableReceiver(path: NodePath, context: ComponentContext): t.Identifier | undefined {
  if (!context.program.reactiveProps || (!path.isJSXIdentifier() && !path.isIdentifier())) return;
  if (!/^[A-Z]/.test(path.node.name)) return;
  const binding = path.scope.getBinding(path.node.name);
  if (!binding || !binding.constant || binding.constantViolations.length) return;
  return t.identifier(path.node.name);
}

/** Mark component boundaries explicitly; the runtime rejects nested reactive proxy escapes. */
function guardBoundary(
  path: NodePath,
  context: ComponentContext,
  kind: 'value' | 'command' | 'ref' = 'value',
  receiver?: t.Expression,
): void {
  if (!path.isExpression() || !referencesDerived(path, context)) return;
  if (receiver && kind === 'value' && hasAsynchronousCallback(path, context))
    throw path.buildCodeFrameError(
      'Reactive render callbacks must be synchronous; asynchronous work belongs in service methods or command callbacks.',
    );
  if (kind === 'value' && !receiver && isDeferredCallback(path, context))
    throw path.buildCodeFrameError(
      'Reactive render-prop callbacks cannot cross component props or JSX children. Call useService in the component that renders the value; on* command callbacks are supported.',
    );
  path.replaceWith(
    t.callExpression(t.memberExpression(t.cloneNode(context.frame), t.identifier('boundary')), [
      path.node,
      t.stringLiteral(kind),
      ...(receiver ? [t.cloneNode(receiver)] : []),
    ]),
  );
  path.skip();
}

/** Obvious deferred functions get a build diagnostic; unknown values get a runtime guard. */
function isDeferredCallback(
  path: NodePath,
  context: ComponentContext,
  seen = new Set<string>(),
): boolean {
  if (path.isFunction()) return true;
  if (path.isTSAsExpression() || path.isTSNonNullExpression() || path.isTSTypeAssertion())
    return isDeferredCallback(path.get('expression') as NodePath<t.Expression>, context, seen);
  if (path.isIdentifier() && !seen.has(path.node.name)) {
    seen.add(path.node.name);
    const declaration = path.scope.getBinding(path.node.name)?.path;
    if (declaration?.isFunctionDeclaration()) return true;
    if (declaration?.isVariableDeclarator()) {
      const init = declaration.get('init');
      if (init.node) return isDeferredCallback(init as NodePath<t.Expression>, context, seen);
    }
  }
  if (path.isCallExpression())
    return isKnownReactHook(path.node.callee, context, 'callback', path.scope);
  return false;
}

export function guardJsxBoundaries(context: ComponentContext): void {
  const { owner, derivedBindings } = context;
  owner.traverse({
    Function(path) {
      skipNestedConsumer(path, context);
    },
    JSXOpeningElement(path) {
      const name = path.node.name;
      const receiver = stableReceiver(path.get('name'), context);
      if (t.isJSXIdentifier(name) && /^[a-z]/.test(name.name)) return;
      for (const attribute of path.get('attributes')) {
        if (attribute.isJSXSpreadAttribute()) {
          const argument = attribute.get('argument');
          guardBoundary(argument, context, 'value', receiver);
          continue;
        }
        if (!attribute.isJSXAttribute()) continue;
        const value = attribute.get('value');
        if (!value.isJSXExpressionContainer()) continue;
        const name = t.isJSXIdentifier(attribute.node.name) ? attribute.node.name.name : '';
        const kind = name === 'ref' ? 'ref' : /^on[A-Z]/.test(name) ? 'command' : 'value';
        guardBoundary(value.get('expression'), context, kind, receiver);
      }
    },
  });
  owner.traverse({
    Function(path) {
      if (context.program.owners.has(path) && path !== owner) {
        path.skip();
        return;
      }
      const node = path.node;
      const name =
        (t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id
          ? node.id.name
          : path.parentPath.isVariableDeclarator() && t.isIdentifier(path.parentPath.node.id)
            ? path.parentPath.node.id.name
            : '';
      if (!/^[A-Z]/.test(name)) return;
      let captured = false;
      path.traverse({
        ReferencedIdentifier(ref) {
          if (derivedBindings.has(ref.node.name)) captured = true;
        },
      });
      if (captured)
        throw path.buildCodeFrameError(
          'Nested components cannot capture parent reactive values. Call useService directly in the nested component.',
        );
    },
    JSXElement(path) {
      const name = path.node.openingElement.name;
      const receiver = stableReceiver(path.get('openingElement').get('name'), context);
      if (t.isJSXIdentifier(name) && /^[a-z]/.test(name.name)) return;
      for (const child of path.get('children')) {
        if (child.isJSXExpressionContainer())
          guardBoundary(child.get('expression'), context, 'value', receiver);
        else if (child.isJSXSpreadChild())
          guardBoundary(child.get('expression'), context, 'value', receiver);
      }
    },
  });
}

/** Mutate factory props before the same call is checked for concealed memo reads. */
export function guardElementFactoryCall(
  path: NodePath<t.CallExpression>,
  context: ComponentContext,
): void {
  if (
    isElementFactory(path.node.callee, context, path.scope) &&
    !t.isStringLiteral(path.node.arguments[0])
  ) {
    const args = path.get('arguments');
    const receiver = args[0] ? stableReceiver(args[0], context) : undefined;
    const props = args[1];
    if (props?.isObjectExpression()) {
      for (const property of props.get('properties')) {
        if (property.isObjectProperty()) {
          const key = property.node.key;
          const name =
            !property.node.computed && (t.isIdentifier(key) || t.isStringLiteral(key))
              ? t.isIdentifier(key)
                ? key.name
                : key.value
              : '';
          const kind = name === 'ref' ? 'ref' : /^on[A-Z]/.test(name) ? 'command' : 'value';
          guardBoundary(property.get('value'), context, kind, receiver);
        } else if (property.isSpreadElement())
          guardBoundary(property.get('argument'), context, 'value', receiver);
        else if (referencesDerived(property, context))
          throw property.buildCodeFrameError(
            'Reactive render-prop methods cannot cross createElement component props. Use an on* command callback or resolve useService in the child.',
          );
      }
    } else if (props) guardBoundary(props, context, 'value', receiver);
    for (const child of args.slice(2)) guardBoundary(child, context, 'value', receiver);
  }
}
