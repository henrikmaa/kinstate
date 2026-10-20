import assert from 'node:assert/strict';
import { transformSync } from '@babel/core';
import { Linter } from 'eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import compiler from '../packages/compiler/dist/index.js';
const linter = new Linter();
const config = [
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error' },
  },
];
const source = `
import { useService } from '@kinstate/react';
import { useId, useState, useEffect } from 'react';
function Display() {
  const service = useService(State);
  const id = useId();
  const [visible] = useState(true);
  useEffect(() => { service.increment(); }, []);
  if (!visible) return null;
  return <div id={id}>{service.count}</div>;
}
`;
const generated = transformSync(source, {
  filename: 'consumer.jsx',
  configFile: false,
  babelrc: false,
  parserOpts: { plugins: ['jsx'] },
  plugins: [compiler],
}).code;
const messages = linter.verify(generated, config);
assert.deepEqual(messages, [], JSON.stringify(messages, null, 2));
assert.match(
  generated,
  /\buse[A-Z]\w*\(\)/,
  'Generated render hook must retain a hook-recognizable name',
);
const invalid = linter.verify('function Display(){ if (flag) useState(0); return null; }', config);
assert.ok(invalid.some((message) => message.ruleId === 'react-hooks/rules-of-hooks'));
console.log('Generated component passes the official Rules of Hooks lint rule.');

for (const wrapper of ['memo(forwardRef', 'm(f']) {
  const wrapped = `import {memo, forwardRef, memo as m, forwardRef as f} from 'react';
import {useService} from '@kinstate/react';
const Display = ${wrapper}((props, ref) => {const service = useService(State); return <div ref={ref}>{service.count}</div>;}));`;
  const output = transformSync(wrapped, {
    filename: 'wrapped.jsx',
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['jsx'] },
    plugins: [compiler],
  }).code;
  assert.deepEqual(
    linter.verify(output, config),
    [],
    'Wrapped consumer must preserve the Rules of Hooks',
  );
}

for (const [name, component] of [
  ['arrow', 'const Display = ({row}) => <div>{row.name}</div>;'],
  ['named', 'function Display({row}) {return <div>{row.name}</div>}'],
  ['default-arrow', 'export default ({row}) => <div>{row.name}</div>;'],
  ['default-function', 'export default function ({row}) {return <div>{row.name}</div>}'],
  ['memo-props', 'const Display = memo(({row}) => <div>{row.name}</div>);'],
  [
    'forward-props',
    'const Display = memo(forwardRef(({row}, ref) => <div ref={ref}>{row.name}</div>));',
  ],
]) {
  const output = transformSync(`import {memo, forwardRef} from 'react';\n${component}`, {
    filename: `receiving-${name}.jsx`,
    configFile: false,
    babelrc: false,
    parserOpts: { plugins: ['jsx'] },
    plugins: [[compiler, { reactiveProps: true }]],
  }).code;
  assert.deepEqual(
    linter.verify(output, config),
    [],
    `${name}: compiled receiving component must preserve the Rules of Hooks`,
  );
}
