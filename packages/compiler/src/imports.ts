import type { NodePath } from '@babel/core';
import * as t from '@babel/types';
import type { ImportBindings } from './context.js';

/** Read authored imports once; downstream passes receive read-only name sets. */
export function collectImports(program: NodePath<t.Program>, source: string): ImportBindings {
  const services = new Set<string>();
  const memoHooks = new Set(['useMemo', 'useCallback']);
  const callbackHooks = new Set(['useCallback']);
  const effectHooks = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);
  const componentWrappers = new Set<string>();
  const hookNames = new Set<string>();
  const namespaceImports = new Set<string>();
  const reactNamespaces = new Set(['React']);
  const elementFactories = new Set<string>();
  for (const statement of program.get('body')) {
    if (!statement.isImportDeclaration()) continue;
    for (const specifier of statement.node.specifiers) {
      if (statement.node.source.value === 'react') {
        if (t.isImportDefaultSpecifier(specifier) || t.isImportNamespaceSpecifier(specifier))
          reactNamespaces.add(specifier.local.name);
        if (
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'createElement' })
        )
          elementFactories.add(specifier.local.name);
        if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
          if (specifier.imported.name === 'useCallback') callbackHooks.add(specifier.local.name);
          if (/^(useEffect|useLayoutEffect|useInsertionEffect)$/.test(specifier.imported.name))
            effectHooks.add(specifier.local.name);
          if (/^(memo|forwardRef)$/.test(specifier.imported.name))
            componentWrappers.add(specifier.local.name);
        }
      }
      if (
        /^react\/jsx-runtime$/.test(statement.node.source.value) &&
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        ['jsx', 'jsxs'].includes(specifier.imported.name)
      )
        elementFactories.add(specifier.local.name);
      if (
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        /^use[A-Z0-9]/.test(specifier.imported.name)
      )
        hookNames.add(specifier.local.name);
      if (statement.node.source.value === source) {
        if (
          t.isImportSpecifier(specifier) &&
          t.isIdentifier(specifier.imported, { name: 'useService' })
        )
          services.add(specifier.local.name);
        if (t.isImportNamespaceSpecifier(specifier)) namespaceImports.add(specifier.local.name);
      }
      if (
        statement.node.source.value === 'react' &&
        t.isImportSpecifier(specifier) &&
        t.isIdentifier(specifier.imported) &&
        /^(useMemo|useCallback)$/.test(specifier.imported.name)
      )
        memoHooks.add(specifier.local.name);
    }
  }
  return {
    services,
    memoHooks,
    callbackHooks,
    effectHooks,
    componentWrappers,
    hookNames,
    namespaceImports,
    reactNamespaces,
    elementFactories,
  };
}
