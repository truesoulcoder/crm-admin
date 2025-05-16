// @ts-check
import globals from 'globals';
import pluginJs from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';
import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: [
      // Build output
      '**/.next/**',
      '**/out/**',
      '**/build/**',
      '**/dist/**',
      // Dependencies
      '**/node_modules/**',
      // Generated files
      'src/types/supabase.ts',
      // Config files
      'next.config.js',
      'postcss.config.js',
      'tailwind.config.js',
      // Public assets
      'public/**',
    ],
  },
  {
    files: ['**/*.js', '**/*.jsx', '**/*.ts', '**/*.tsx'],
    extends: [
      'eslint:recommended',
      'plugin:@typescript-eslint/recommended',
      'plugin:import/typescript',
      'plugin:import/recommended',
      'plugin:react-hooks/recommended',
    ],
    plugins: {
      '@typescript-eslint': tseslint,
      '@next/next': nextPlugin,
      'import': importPlugin,
      'react-hooks': 'react-hooks',
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    parser: '@typescript-eslint/parser',
    parserOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      project: './tsconfig.json',
      tsconfigRootDir: __dirname,
    },
    settings: {
      'import/resolver': {
        typescript: {},
        node: {
          extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
        },
      },
      'import/parsers': {
        '@typescript-eslint/parser': ['.ts', '.tsx'],
      },
      react: {
        version: 'detect',
      },
    },
    rules: {
      // Basic rules
      'no-console': 'warn',
      'no-unused-vars': 'off', // Handled by @typescript-eslint
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message: 'Prefer absolute imports using the @/ alias',
            },
          ],
        },
      ],

      // TypeScript rules
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { 
          argsIgnorePattern: '^_', 
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',

      // React Hooks rules
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // Import rules
      'import/order': [
        'error',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-unresolved': ['error', { commonjs: true, caseSensitive: true }],
      'import/named': 'error',
      'import/default': 'error',
      'import/namespace': 'error',
      'import/export': 'error',
      'import/no-named-as-default': 'error',
      'import/no-named-as-default-member': 'error',
      'import/no-duplicates': 'error',
      'import/no-cycle': 'warn',
      'import/no-self-import': 'error',
      'import/no-useless-path-segments': 'warn',
      'import/first': 'error',
      'import/newline-after-import': 'warn',
    },
  },
  // Next.js specific rules
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      '@next/next/no-html-link-for-pages': 'off', // We use Next.js App Router
      '@next/next/no-img-element': 'warn',
      '@next/next/no-sync-scripts': 'error',
      '@next/next/no-typos': 'error',
      '@next/next/no-unwanted-polyfillio': 'error',
      '@next/next/no-page-custom-font': 'off',
      '@next/next/no-css-tags': 'off',
    },
  },
];
