import type { NodePath } from '@babel/core';
import type * as t from '@babel/types';

/** Babel paths, not AST nodes, identify component boundaries throughout a pass. */
export type ConsumerOwners = Map<NodePath<t.Function>, NodePath<t.CallExpression>[]>;

export interface ImportBindings {
  readonly services: ReadonlySet<string>;
  readonly memoHooks: ReadonlySet<string>;
  readonly callbackHooks: ReadonlySet<string>;
  readonly effectHooks: ReadonlySet<string>;
  readonly componentWrappers: ReadonlySet<string>;
  readonly hookNames: ReadonlySet<string>;
  readonly namespaceImports: ReadonlySet<string>;
  readonly reactNamespaces: ReadonlySet<string>;
  readonly elementFactories: ReadonlySet<string>;
}

export interface ProgramContext {
  readonly reactiveProps?: boolean;
  readonly program: NodePath<t.Program>;
  readonly imports: ImportBindings;
  readonly owners: ReadonlyMap<NodePath<t.Function>, NodePath<t.CallExpression>[]>;
}

/** Completed binding facts are read-only to validators and syntax transforms. */
export interface ComponentContext {
  readonly program: ProgramContext;
  readonly owner: NodePath<t.Function>;
  readonly frame: t.Identifier;
  readonly serviceBindings: ReadonlySet<string>;
  readonly derivedBindings: ReadonlySet<string>;
}

/** Only component preparation and fixed-point analysis may grow binding facts. */
export interface MutableComponentContext extends ComponentContext {
  readonly serviceBindings: Set<string>;
  readonly derivedBindings: Set<string>;
}
