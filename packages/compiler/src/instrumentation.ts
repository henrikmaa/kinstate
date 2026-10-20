import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import { isHook, isWriteTarget, skipNestedConsumer } from './ast.js';
import type { ComponentContext } from './context.js';
import { createReadWrapper, chainContinues, isReferenceOperand } from './read-collection.js';
import { installRenderFrame } from './component.js';
import { instrumentDestructuring } from './patterns.js';
import { instrumentForOf } from './iteration.js';

/** Exit visitors preserve expression evaluation order; generated calls are never revisited. */
export function instrumentComponent(context: ComponentContext, frameHook: t.Identifier): void {
  const { owner, frame } = context;
  const { hookNames } = context.program.imports;
  const generated = new WeakSet<t.Node>();
  const wrap = createReadWrapper(context, generated);
  owner.traverse({
    Function(path) {
      skipNestedConsumer(path, context);
    },
    ForOfStatement: {
      exit(path) {
        instrumentForOf(path, frame, hookNames, wrap);
      },
    },
    ForInStatement: {
      exit(path) {
        path.node.right = t.callExpression(
          t.memberExpression(t.cloneNode(frame), t.identifier('keys')),
          [path.node.right],
        );
      },
    },
    VariableDeclarator: {
      exit(path) {
        instrumentDestructuring(path, frame, hookNames);
      },
    },
    'MemberExpression|OptionalMemberExpression': {
      exit(path) {
        if (!(path.isMemberExpression() || path.isOptionalMemberExpression())) return;
        if (chainContinues(path)) return;
        if (t.isIdentifier(path.node.object, { name: frame.name })) return;
        // Preserve reference receivers and contiguous optional-chain evaluation.
        if (isReferenceOperand(path) || isWriteTarget(path)) return;
        wrap(path as NodePath<t.Expression>);
      },
    },
    'CallExpression|OptionalCallExpression': {
      exit(path) {
        if (!(path.isCallExpression() || path.isOptionalCallExpression())) return;
        if (generated.has(path.node) || chainContinues(path)) return;
        const callee = path.node.callee;
        if (isHook(callee, hookNames)) return;
        if (!(
          (t.isMemberExpression(callee) || t.isOptionalMemberExpression(callee)) &&
          t.isIdentifier(callee.object, { name: frame.name })
        ))
          wrap(path as NodePath<t.Expression>);
      },
    },
    AssignmentExpression: {
      exit(path) {
        if (t.isObjectPattern(path.node.left) || t.isArrayPattern(path.node.left)) wrap(path);
      },
    },
    TaggedTemplateExpression: {
      exit(path) {
        wrap(path);
      },
    },
    UnaryExpression: {
      exit(path) {
        if (path.node.operator === 'delete') wrap(path);
      },
    },
    ObjectExpression: {
      exit(path) {
        if (path.node.properties.some((p) => t.isSpreadElement(p))) wrap(path);
      },
    },
    ArrayExpression: {
      exit(path) {
        if (path.node.elements.some((p) => t.isSpreadElement(p))) wrap(path);
      },
    },
    BinaryExpression: {
      exit(path) {
        if (path.node.operator === 'in') wrap(path);
      },
    },
    ReturnStatement(path) {
      if (path.getFunctionParent() !== owner) return;
      let branch: NodePath = path;
      while (branch.parentPath && branch.parentPath !== owner) {
        const parent = branch.parentPath;
        if (parent.isTryStatement() && parent.node.finalizer && branch.key !== 'finalizer')
          throw path.buildCodeFrameError(
            'Component returns cannot cross finally blocks because finally may replace the result after render tracking closes. Return after try/finally or move cleanup before returning.',
          );
        branch = parent;
      }

      path.node.argument = t.callExpression(
        t.memberExpression(t.cloneNode(frame), t.identifier('finish')),
        [path.node.argument ?? t.identifier('undefined')],
      );
    },
  });
  installRenderFrame(context, frameHook);
}
