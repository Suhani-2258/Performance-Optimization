import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
export default [
  js.configs.recommended,
  {
    files: ['**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': hooks },
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest }, parserOptions: { ecmaFeatures: { jsx: true } }, sourceType: 'module' },
    settings: { react: { version: '18' } },
    rules: { ...react.configs.recommended.rules, ...hooks.configs.recommended.rules, 'react/prop-types': 'off', 'react/react-in-jsx-scope': 'off' },
  },
];
