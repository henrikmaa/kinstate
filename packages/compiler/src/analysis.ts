import * as t from '@babel/types';
import { skipNestedConsumer } from './ast.js';
import type { MutableComponentContext } from './context.js';
import { collectDerivedBindings, collectServiceAliases } from './binding-analysis.js';
import { guardElementFactoryCall, guardJsxBoundaries } from './component-boundaries.js';
import { normalizeBusinessCalls } from './business-calls.js';
import { validateMemoCall, validateServiceReferences } from './service-validation.js';

/**
 * Analysis grows binding facts and emits diagnostics; guard passes also mutate AST expressions.
 * Preserve this order: it defines diagnostic precedence and which rewritten expressions later
 * visitors see. In particular, factory guards and memo validation remain interleaved per call.
 */
export function analyzeAndGuardComponent(context: MutableComponentContext): void {
  collectServiceAliases(context);
  collectDerivedBindings(context);
  normalizeBusinessCalls(context);
  validateServiceReferences(context);
  guardJsxBoundaries(context);
  context.owner.traverse({
    Function(path) {
      skipNestedConsumer(path, context);
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
      validateMemoCall(path, context);
    },
  });
}
