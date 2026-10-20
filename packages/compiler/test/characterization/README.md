# Compiler characterization corpus

`corpus.json` contains 39 independent source programs and their complete public
Babel transformation results, captured before the compiler maintenance refactor.
Accepted inputs freeze both generated code and the complete source map (including
original source text); rejected inputs freeze the entire diagnostic and code
frame. The tests always execute the current source plugin. They have no dependency
on a previous compiler build, internal passes, or helper implementations.

The corpus covers component/hook aliases, React namespace and imported wrappers,
memo/forwardRef composition, multiple services and ordinary hooks, early returns,
custom props and commands, createElement, effects, optional-chain receivers and
TypeScript wrappers, mutation contexts, existence and iteration, loop patterns
and labels, destructuring assignments, tagged templates, synchronous callbacks,
name collisions and directives. Rejected examples cover escaping services,
render props, hidden memo dependencies, invalid component/hook shapes, mutable
service bindings, and hooks in destructuring defaults. An ordinary component is
also frozen to guard against instrumenting unrelated code.

Run `npx vitest run packages/compiler/test/characterization.test.ts` from the
repository root. Treat changes to this corpus as changes to the compiler's public
contract: review generated output and source maps or diagnostics explicitly. Do
not regenerate expected results merely to make a refactor pass. Runtime semantics,
React integration, and subscription behavior remain covered by the other compiler
and cross-package suites; byte-for-byte characterization complements those tests.
