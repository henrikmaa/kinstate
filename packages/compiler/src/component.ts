import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ComponentContext, MutableComponentContext, ProgramContext } from './context.js';
import { isComponentWrapper } from './react-calls.js';

/** Only context-free defaults can move from the parameter environment into the body. */
function isContextFreeDefault(node: t.Node): boolean {
  if (
    t.isStringLiteral(node) ||
    t.isNumericLiteral(node) ||
    t.isBooleanLiteral(node) ||
    t.isNullLiteral(node) ||
    t.isBigIntLiteral(node) ||
    t.isDecimalLiteral(node) ||
    t.isRegExpLiteral(node)
  )
    return true;
  if (t.isUnaryExpression(node)) return isContextFreeDefault(node.argument);
  if (t.isArrayExpression(node))
    return node.elements.every((value) => value === null || isContextFreeDefault(value));
  if (t.isObjectExpression(node))
    return node.properties.every(
      (property) =>
        t.isObjectProperty(property) && !property.computed && isContextFreeDefault(property.value),
    );
  if (
    t.isTSAsExpression(node) ||
    t.isTSTypeAssertion(node) ||
    t.isTSNonNullExpression(node) ||
    t.isTSSatisfiesExpression(node)
  )
    return isContextFreeDefault(node.expression);
  return false;
}

/** Normalize a component and add the private frame argument to its service hooks. */
export function prepareComponent(
  context: ProgramContext,
  owner: NodePath<t.Function>,
  calls: NodePath<t.CallExpression>[],
): MutableComponentContext {
  const node = owner.node;
  if (
    context.reactiveProps &&
    (t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) &&
    node.id &&
    !/^[A-Z]/.test(node.id.name)
  ) {
    let generated: t.Identifier;
    do {
      generated = t.identifier(`Reactive${owner.scope.generateUidIdentifier('Component').name}`);
    } while (owner.scope.hasBinding(generated.name) || owner.scope.hasGlobal(generated.name));
    const binding = owner.scope.getBinding(node.id.name);
    if (binding?.constantViolations.length)
      throw owner.buildCodeFrameError('Receiving component function names must not be reassigned.');
    for (const reference of binding?.referencePaths ?? []) {
      if (reference.isIdentifier()) reference.node.name = generated.name;
    }
    node.id.name = generated.name;
  }

  const name =
    wrappedComponentName(context, owner) ||
    (context.reactiveProps &&
    owner.parentPath.isVariableDeclarator() &&
    t.isIdentifier(owner.parentPath.node.id)
      ? owner.parentPath.node.id.name
      : '') ||
    (context.reactiveProps && owner.parentPath.isExportDefaultDeclaration()
      ? 'DefaultComponent'
      : '') ||
    ((t.isFunctionDeclaration(node) || t.isFunctionExpression(node)) && node.id
      ? node.id.name
      : owner.parentPath.isVariableDeclarator() && t.isIdentifier(owner.parentPath.node.id)
        ? owner.parentPath.node.id.name
        : owner.parentPath.isExportDefaultDeclaration()
          ? 'DefaultComponent'
          : '');
  if (!/^[A-Z]/.test(name))
    throw owner.buildCodeFrameError(
      'useService is supported directly in function components, not custom hooks or anonymous callbacks.',
    );
  if (node.async || node.generator)
    throw owner.buildCodeFrameError(
      'Reactive service consumers must be synchronous function components.',
    );
  if (!t.isBlockStatement(node.body)) node.body = t.blockStatement([t.returnStatement(node.body)]);
  const frame = owner.scope.generateUidIdentifier('serviceFrame');
  const serviceBindings = new Set<string>();
  const derivedBindings = new Set<string>();
  if (context.reactiveProps) {
    const parameterDeclarations: t.Statement[] = [];
    const parameterNames = new Set(
      node.params.flatMap((parameter) => Object.keys(t.getBindingIdentifiers(parameter))),
    );
    for (const statement of (node.body as t.BlockStatement).body) {
      if (
        t.isFunctionDeclaration(statement) &&
        statement.id &&
        parameterNames.has(statement.id.name)
      )
        throw owner.buildCodeFrameError(
          'Receiving component parameter bindings cannot also be body function declarations. Rename the function or read props inside the body.',
        );
    }
    for (let index = 0; index < node.params.length; index++) {
      const parameter = node.params[index]!;
      if (t.isIdentifier(parameter)) derivedBindings.add(parameter.name);
      else if (t.isObjectPattern(parameter) || t.isArrayPattern(parameter)) {
        t.traverseFast(parameter, (candidate) => {
          if (t.isAssignmentPattern(candidate) && !isContextFreeDefault(candidate.right))
            throw owner.buildCodeFrameError(
              'Tracked component parameter defaults must move into the component body to preserve parameter environments.',
            );
        });
        const input = owner.scope.generateUidIdentifier('props');
        node.params[index] = input;
        parameterDeclarations.push(
          t.variableDeclaration('var', [t.variableDeclarator(parameter, t.cloneNode(input))]),
        );
        derivedBindings.add(input.name);
      } else
        throw owner.buildCodeFrameError(
          'Tracked local components require ordinary or destructured props; parameter defaults and rest parameters must move into the component body.',
        );
    }
    (node.body as t.BlockStatement).body.unshift(...parameterDeclarations);
  }
  for (const call of calls) {
    if (call.node.arguments.length !== 1)
      throw call.buildCodeFrameError('useService expects one service constructor.');
    call.node.arguments.push(t.cloneNode(frame));
    if (call.parentPath.isVariableDeclarator() && t.isIdentifier(call.parentPath.node.id))
      serviceBindings.add(call.parentPath.node.id.name);
    else
      throw call.buildCodeFrameError(
        'Assign useService to a local binding before reading properties, so hooks remain outside tracking callbacks.',
      );
  }

  if (context.reactiveProps) owner.scope.crawl();
  return { program: context, owner, frame, serviceBindings, derivedBindings };
}

/** Only React's documented component wrappers establish anonymous component owners. */
function wrappedComponentName(context: ProgramContext, owner: NodePath<t.Function>): string {
  let current: NodePath = owner;
  let wrapped = false;
  while (current.parentPath?.isCallExpression()) {
    const call = current.parentPath;
    if (call.node.arguments[0] !== current.node) break;
    const callee = call.node.callee;
    const known = isComponentWrapper(callee, context.imports);
    if (!known) break;
    wrapped = true;
    current = call;
  }
  if (!wrapped) return '';
  if (current.parentPath?.isVariableDeclarator() && t.isIdentifier(current.parentPath.node.id))
    return current.parentPath.node.id.name;
  if (current.parentPath?.isExportDefaultDeclaration()) return 'DefaultComponent';
  return '';
}

/** Insert hooks after analysis/instrumentation so generated setup is never transformed. */
export function installRenderFrame(context: ComponentContext, frameHook: t.Identifier): void {
  const { owner, frame } = context;
  const body = owner.node.body as t.BlockStatement;
  if (!body.directives.some((d) => d.value.value === 'use no memo'))
    body.directives.push(t.directive(t.directiveLiteral('use no memo')));
  body.body.unshift(
    t.variableDeclaration('const', [
      t.variableDeclarator(frame, t.callExpression(t.cloneNode(frameHook), [])),
    ]),
  );
  body.body.push(
    t.expressionStatement(
      t.callExpression(t.memberExpression(t.cloneNode(frame), t.identifier('finish')), [
        t.identifier('undefined'),
      ]),
    ),
  );
}
