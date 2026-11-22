import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.output/**', '**/.wxt/**', '**/dist/**', 'apps/site/public/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-restricted-syntax': ['error', {
        selector: "MemberExpression[property.name='innerHTML']",
        message: 'Never use innerHTML with page or model text. Render with text nodes.',
      }],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    ignores: ['packages/core/src/ai-adapter.ts', 'packages/core/src/schema.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['firebase', 'firebase/*'], message: 'firebase/ai is imported only in ai-adapter.ts and schema.ts.' }] }],
      'no-restricted-globals': ['error', { name: 'chrome', message: 'packages/core never calls chrome.*' }],
    },
  },
);
