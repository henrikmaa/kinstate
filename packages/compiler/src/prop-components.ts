import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ConsumerOwners, ImportBindings } from './context.js';
import { isImportedComponentWrapper } from './react-calls.js';

/** Find an authored component's binding expression without trusting arbitrary wrappers. */
export function componentExpression(
  owner: NodePath<t.Function>,
  imports: ImportBindings,
): NodePath {
  let expression: NodePath = owner;
  while (expression.parentPath?.isCallExpression()) {
    const call = expression.parentPath;
    if (call.node.arguments[0] !== expression.node || !isImportedComponentWrapper(call, imports))
      break;
    expression = call;
  }
  return expression;
}

/** Local ordinary calls prove a PascalCase binding is a utility, not a React receiver. */
function ordinaryInvocation(
  owner: NodePath<t.Function>,
  expression: NodePath,
): NodePath | undefined {
  const parent = expression.parentPath;
  const names = new Set<string>();
  if (owner.isFunctionDeclaration() && owner.node.id) names.add(owner.node.id.name);
  if (parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id))
    names.add(parent.node.id.name);
  const seen = new Set<t.Node>();
  const inspect = (binding: ReturnType<NodePath['scope']['getBinding']>): NodePath | undefined => {
    if (!binding || seen.has(binding.identifier)) return;
    seen.add(binding.identifier);
    for (const reference of binding.referencePaths) {
      const use = reference.parentPath;
      if (!use) continue;
      if (
        (use.isCallExpression() || use.isOptionalCallExpression() || use.isNewExpression()) &&
        use.node.callee === reference.node
      )
        return use;
      if (use.isTaggedTemplateExpression() && use.node.tag === reference.node) return use;
      if (
        (use.isCallExpression() || use.isOptionalCallExpression()) &&
        (t.isMemberExpression(use.node.callee) || t.isOptionalMemberExpression(use.node.callee)) &&
        !use.node.callee.computed &&
        t.isIdentifier(use.node.callee.property) &&
        /^(map|flatMap|forEach|filter|reduce|reduceRight|find|findIndex|some|every)$/.test(
          use.node.callee.property.name,
        ) &&
        use.node.arguments[0] === reference.node
      )
        return use;
      if (
        use.isJSXExpressionContainer() &&
        use.parentPath.isJSXAttribute() &&
        t.isJSXIdentifier(use.parentPath.node.name) &&
        (/^on[A-Z]/.test(use.parentPath.node.name.name) || use.parentPath.node.name.name === 'ref')
      )
        return use;
      if (
        use.isVariableDeclarator() &&
        use.node.init === reference.node &&
        t.isIdentifier(use.node.id)
      ) {
        const invocation = inspect(use.scope.getBinding(use.node.id.name));
        if (invocation) return invocation;
      }
    }
  };
  for (const name of names) {
    const invocation = inspect(owner.scope.getBinding(name));
    if (invocation) return invocation;
  }
}

/** Opt-in PascalCase candidates must not also be invoked as ordinary helpers. */
export function discoverPropComponents(
  program: NodePath<t.Program>,
  owners: ConsumerOwners,
  imports: ImportBindings,
): void {
  program.traverse({
    Function(path) {
      if (!(
        path.isFunctionDeclaration() ||
        path.isFunctionExpression() ||
        path.isArrowFunctionExpression()
      ))
        return;
      const expression = componentExpression(path, imports);
      const parent = expression.parentPath;
      const name =
        path.isFunctionDeclaration() && path.node.id
          ? path.node.id.name
          : parent?.isVariableDeclarator() && t.isIdentifier(parent.node.id)
            ? parent.node.id.name
            : '';
      if (/^[A-Z]/.test(name) || parent?.isExportDefaultDeclaration()) {
        const invocation = ordinaryInvocation(path, expression);
        if (invocation) {
          if (owners.has(path))
            throw invocation.buildCodeFrameError(
              'Service-consuming components must be rendered by React, not called as ordinary functions. Use JSX or createElement.',
            );
          return;
        }
        if (!path.node.async && !path.node.generator && !owners.has(path)) owners.set(path, []);
      }
    },
  });
}

/** Generated owner names must satisfy React's documented component naming convention. */
function defaultComponentName(owner: NodePath<t.Function>): t.Identifier {
  let name: t.Identifier;
  do {
    name = t.identifier(`Reactive${owner.scope.generateUidIdentifier('DefaultComponent').name}`);
  } while (owner.scope.hasBinding(name.name) || owner.scope.hasGlobal(name.name));
  return name;
}

/** Mark the actual exported/called receiver. Hoisted declarations are registered before authored effects. */
export function markComponent(
  owner: NodePath<t.Function>,
  imports: ImportBindings,
  marker: t.Identifier,
): void {
  const expression = componentExpression(owner, imports);
  if (owner.isFunctionDeclaration()) {
    if (!owner.node.id) owner.node.id = defaultComponentName(owner);
    const statement = t.expressionStatement(
      t.callExpression(t.cloneNode(marker), [t.cloneNode(owner.node.id)]),
    );
    const scope = owner.parentPath.isExportDeclaration()
      ? owner.parentPath.parentPath
      : owner.parentPath;
    if (scope.isProgram()) scope.unshiftContainer('body', statement);
    else if (scope.isBlockStatement()) scope.unshiftContainer('body', statement);
    else
      throw owner.buildCodeFrameError(
        'Reactive function declarations require a program or block scope.',
      );
  } else if (expression.isExpression()) {
    const declarator = expression.parentPath;
    if (declarator.isVariableDeclarator() && t.isIdentifier(declarator.node.id)) {
      const declaration = declarator.parentPath;
      if (!declaration.isVariableDeclaration()) return;
      if (declaration.node.declarations.length !== 1)
        throw owner.buildCodeFrameError(
          'Declare reactive receiving components in their own variable statement.',
        );
      const statement = declaration.parentPath.isExportNamedDeclaration()
        ? declaration.parentPath
        : declaration;
      if (!statement.parentPath.isProgram() && !statement.parentPath.isBlockStatement())
        throw owner.buildCodeFrameError(
          'Reactive receiving component bindings require a program or block scope.',
        );
      statement.insertAfter(
        t.expressionStatement(
          t.callExpression(t.cloneNode(marker), [t.cloneNode(declarator.node.id)]),
        ),
      );
    } else if (declarator.isExportDefaultDeclaration()) {
      const name = defaultComponentName(owner);
      declarator.replaceWithMultiple([
        t.variableDeclaration('const', [t.variableDeclarator(t.cloneNode(name), expression.node)]),
        t.expressionStatement(t.callExpression(t.cloneNode(marker), [t.cloneNode(name)])),
        t.exportDefaultDeclaration(t.cloneNode(name)),
      ]);
    } else
      throw owner.buildCodeFrameError(
        'Reactive receiving components require a named binding or a default export.',
      );
  }
}
