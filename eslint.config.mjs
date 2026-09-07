import { defineConfig, globalIgnores } from 'eslint/config'
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

export default defineConfig([
  globalIgnores([
    '**/node_modules/**',
    '**/.next/**',
    '**/dist/**',
    '**/coverage/**',
    '**/*.tsbuildinfo',
    '**/next-env.d.ts',
    '*.config.mjs',
    '*.config.ts',
    '.monkeycode-tmp-files/**'
  ]),

  // Backend: plain Node.js ESM
  {
    files: ['apps/api/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    plugins: { js, '@typescript-eslint': tseslint.plugin },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },

  // Next.js apps (storefront + admin) — eslint-config-next bundles TS/React rules
  ...nextVitals,
  ...nextTs,
  {
    files: ['apps/storefront/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      // App Router projects have no pages/ directory; rule needs one to function.
      '@next/next/no-html-link-for-pages': 'off'
    }
  },

  // TypeScript packages + tooling
  {
    files: ['packages/**/*.ts', 'scripts/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node }
    }
  },
  ...tseslint.configs.recommended
])
