module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  extends: ['eslint:recommended', 'plugin:react/jsx-runtime', 'plugin:react-hooks/recommended'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: { 'react/jsx-uses-vars': 'error' },
  overrides: [{ files: ['*.mjs', '*.test.js'], env: { node: true } }],
};
