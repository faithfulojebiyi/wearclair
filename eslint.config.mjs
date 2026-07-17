// @ts-check
import importPlugin from 'eslint-plugin-import';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

import eslint from '@eslint/js';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'webpack.config.js',
      'dashboard',
      'mobile',
      'dist',
      'orm',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: './tsconfig.json',
        },
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off',
      'no-console': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'off',
      '@typescript-eslint/no-misused-promises': [
        'error',
        {
          checksVoidReturn: false,
          checksConditionals: false,
        },
      ],
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off',
      '@typescript-eslint/no-base-to-string': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/only-throw-error': 'off',
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
      // module boundaries: api <-> worker stay isolated, shared libs never import an
      // app, and als (http-request-scoped) is off-limits to the worker.
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: 'apps/api',
              from: 'apps/worker',
              message: 'api app cannot import from the worker app',
            },
            {
              target: 'apps/worker',
              from: 'apps/api',
              message: 'worker app cannot import from the api app',
            },
            {
              target: 'apps/worker',
              from: 'libs/system/als',
              message: 'worker app cannot import the als service (http-request-scoped)',
            },
            {
              target: 'libs',
              from: 'apps/api',
              message: 'shared libs cannot import from the api app',
            },
            {
              target: 'libs',
              from: 'apps/worker',
              message: 'shared libs cannot import from the worker app',
            },
          ],
        },
      ],
    },
  },
  {
    // bun test specs: `bun:test` is a bun builtin the import resolver can't see,
    // and bun's async matchers (.resolves/.rejects) aren't typed as Thenable.
    files: ['**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'import/no-unresolved': ['error', { ignore: ['^bun:'] }],
      '@typescript-eslint/await-thenable': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },
  {
    // standalone scripts (seed, migrations, one-offs) legitimately log to the console.
    files: ['prisma/**/*.ts', 'timeseries/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
