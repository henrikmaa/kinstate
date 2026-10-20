import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ImportBindings } from './context.js';
import { isImportedComponentWrapper } from './react-calls.js';

interface WrapperRegistration {
  readonly call: NodePath<t.CallExpression>;
  readonly inner: t.Identifier;
}

/** Only compiler-recognized wrappers and immutable identifier arguments establish trust edges. */
export function discoverReceiverWrappers(
  program: NodePath<t.Program>,
  imports: ImportBindings,
): WrapperRegistration[] {
  const registrations: WrapperRegistration[] = [];
  program.traverse({
    CallExpression(path) {
      if (path.getFunctionParent() || !isImportedComponentWrapper(path, imports)) return;
      const argument = path.node.arguments[0];
      if (!t.isIdentifier(argument)) return;
      const binding = path.scope.getBinding(argument.name);
      if (!binding || !binding.constant || binding.constantViolations.length) return;
      const parent = path.parentPath;
      if (
        parent.isExportDefaultDeclaration() ||
        (parent.isVariableDeclarator() &&
          t.isIdentifier(parent.node.id) &&
          /^[A-Z]/.test(parent.node.id.name))
      )
        registrations.push({ call: path, inner: t.cloneNode(argument) });
    },
  });
  return registrations;
}

/** Keep the original wrapper expression and every argument evaluation exactly once. */
export function registerReceiverWrappers(
  registrations: readonly WrapperRegistration[],
  marker: t.Identifier,
): void {
  for (const { call, inner } of registrations) {
    const parent = call.parentPath;
    if (parent.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
      const declaration = parent.parentPath;
      if (!declaration.isVariableDeclaration()) continue;
      if (declaration.node.declarations.length !== 1)
        throw call.buildCodeFrameError(
          'Declare reactive receiver wrappers in their own variable statement.',
        );
      const statement = declaration.parentPath.isExportNamedDeclaration()
        ? declaration.parentPath
        : declaration;
      statement.insertAfter(
        t.expressionStatement(
          t.callExpression(t.cloneNode(marker), [t.cloneNode(parent.node.id), inner]),
        ),
      );
    } else if (parent.isExportDefaultDeclaration()) {
      const receiver = parent.scope.generateUidIdentifier('ReactiveWrapper');
      parent.replaceWithMultiple([
        t.variableDeclaration('const', [t.variableDeclarator(t.cloneNode(receiver), call.node)]),
        t.expressionStatement(
          t.callExpression(t.cloneNode(marker), [t.cloneNode(receiver), inner]),
        ),
        t.exportDefaultDeclaration(t.cloneNode(receiver)),
      ]);
    }
  }
}
