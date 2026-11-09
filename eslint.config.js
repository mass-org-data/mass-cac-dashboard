const browserGlobals = Object.fromEntries([
  'AbortController','Blob','clearInterval','clearTimeout','console','crypto','document','Event','fetch','FormData',
  'globalThis','history','localStorage','location','navigator','queueMicrotask','setInterval','setTimeout','URL','URLSearchParams','window',
].map(name => [name, 'readonly']));

const nodeGlobals = Object.fromEntries([
  'Buffer','console','fetch','globalThis','process','setInterval','setTimeout','URL',
].map(name => [name, 'readonly']));

const safetyRules = {
  'no-dupe-keys': 'error',
  'no-eval': 'error',
  'no-func-assign': 'error',
  'no-implied-eval': 'error',
  'no-import-assign': 'error',
  'no-new-func': 'error',
  'no-script-url': 'error',
  'no-throw-literal': 'error',
  'no-undef': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-useless-catch': 'error',
  'no-with': 'error',
  'valid-typeof': 'error',
};

export default [
  {ignores: ['dist/**', 'node_modules/**']},
  {
    files: ['src/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: browserGlobals},
    rules: safetyRules,
  },
  {
    files: ['scripts/**/*.mjs', 'scripts/**/*.js'],
    languageOptions: {ecmaVersion: 'latest', sourceType: 'module', globals: nodeGlobals},
    rules: safetyRules,
  },
];
