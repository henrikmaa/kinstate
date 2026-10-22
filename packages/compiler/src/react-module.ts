import type { NodePath } from '@babel/core';
import * as t from '@babel/types';

/** Plain engine/config modules must never acquire React hooks from naming alone. */
export function hasReactModuleEvidence(
  program: NodePath<t.Program>,
  filename: string | null | undefined,
  serviceSource: string,
): boolean {
  if (filename && /\.[cm]?[jt]sx$/.test(filename)) return true;
  for (const statement of program.node.body) {
    if (!t.isImportDeclaration(statement) || statement.importKind === 'type') continue;
    if (!['react', 'react/jsx-runtime', serviceSource].includes(statement.source.value)) continue;
    if (
      statement.specifiers.some(
        (specifier) => !t.isImportSpecifier(specifier) || specifier.importKind !== 'type',
      )
    )
      return true;
  }
  let evidence = false;
  t.traverseFast(program.node, (node) => {
    if (t.isJSXElement(node) || t.isJSXFragment(node)) evidence = true;
    if (
      t.isCallExpression(node) &&
      t.isMemberExpression(node.callee) &&
      !node.callee.computed &&
      t.isIdentifier(node.callee.object, { name: 'React' }) &&
      t.isIdentifier(node.callee.property) &&
      /^(createElement|jsx|jsxs)$/.test(node.callee.property.name)
    )
      evidence = true;
  });
  return evidence;
}
