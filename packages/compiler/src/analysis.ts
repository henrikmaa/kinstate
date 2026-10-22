import * as t from '@babel/types';
import { skipNestedConsumer } from './ast.js';
import type { MutableComponentContext } from './context.js';
import {
  collectDerivedBindings,
  collectServiceAliases,
  referencesDerived,
} from './binding-analysis.js';
import { guardElementFactoryCall, guardJsxBoundaries } from './component-boundaries.js';
import { certifyReactStateSetters } from './react-state-setters.js';
import { isReactRefWrite } from './react-refs.js';
import { normalizeBusinessCalls } from './business-calls.js';
import { validateMemoCall, validateServiceReferences } from './service-validation.js';

/**
 * Analysis grows binding facts and emits diagnostics; guard passes also mutate AST expressions.
 * Preserve this order: it defines diagnostic precedence and which rewritten expressions later
 * visitors see. In particular, factory guards and memo validation remain interleaved per call.
 */
export function analyzeAndGuardComponent(
  context: MutableComponentContext,
  memoHook?: t.Identifier,
): boolean {
  let memoUsed = false;
  collectServiceAliases(context);
  collectDerivedBindings(context);
  normalizeBusinessCalls(context);
  validateServiceReferences(context);
  guardJsxBoundaries(context);
  context.owner.traverse({
    Function(path) {
      skipNestedConsumer(path, context);
    },
    AssignmentExpression(path) {
      if (!isReactRefWrite(path, context) || !referencesDerived(path.get('right'), context)) return;
      // Refs can retain evaluated snapshots after commit, but cannot conceal
      // live service proxies or deferred render callbacks from subscriptions.
      path.node.right = t.callExpression(
        t.memberExpression(t.cloneNode(context.frame), t.identifier('boundary')),
        [path.node.right, t.stringLiteral('value')],
      );
    },
    CallExpression(path) {
      const callee = path.node.callee;
      if (
        t.isMemberExpression(callee) &&
        callee.computed &&
        t.isIdentifier(callee.object) &&
        context.program.imports.reactNamespaces.has(callee.object.name)
      ) {
        const declaration = path.scope.getBinding(callee.object.name)?.path.parentPath;
        if (declaration?.isImportDeclaration() && declaration.node.source.value === 'react')
          throw path.buildCodeFrameError(
            'Computed React namespace calls cannot be tracked safely. Use a named React hook or a direct React member call.',
          );
      }
      guardElementFactoryCall(path, context);
      memoUsed = validateMemoCall(path, context, memoHook) || memoUsed;
    },
  });
  certifyReactStateSetters(context);
  return memoUsed;
}
