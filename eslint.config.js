// ESLint flat config (v9+) — uses packages already pinned in package.json.
// Mirrors the project's coding conventions: strict TS, React hooks rules,
// React Refresh export rules for routes/components. Configs that conflict
// with how this codebase is structured (e.g. floating promises in TanStack
// Start handlers) are dialed back deliberately — see comments inline.

import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '.output/**',
      '.tanstack/**',
      '.pnpm-store/**',
      'coverage/**',
      'UI-design-template/**',
      'researchScreenshots/**',
      // Generated TanStack Router tree.
      'app/routeTree.gen.ts',
      // Skill bundles shipped by deps (not our source).
      'mcps/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      ...reactHooks.configs.recommended.rules,

      // `set-state-in-effect` is a new advisory rule in v7. The existing
      // patterns in this codebase (debounce, hydrate from localStorage) are
      // legitimate; surface as a warning for future cleanup rather than
      // blocking. Revisit once the legacy components are refactored.
      'react-hooks/set-state-in-effect': 'warn',

      // TanStack Router/Start expects route + server-fn modules to re-export
      // both a component/handler and the `Route` / server-fn object alongside
      // each other; warn (not error) so legitimate cases pass.
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],

      // Underscore prefix opts a binding out of unused-var checks.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],

      // `any` is occasionally pragmatic at TanStack Start / pg boundaries;
      // warn rather than error so it surfaces in review without blocking.
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },

  // Test files get looser unused-var enforcement (vi.mock hoisting, etc.).
  {
    files: ['tests/**/*.ts', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // Plain config files (vite.config.ts, vitest.config.ts, this file, etc.).
  {
    files: ['*.config.{js,mjs,cjs,ts}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // Legacy monolithic route file. PR4 dismantles `app/routes/index.tsx` into
  // feature modules; until then, suppress the fast-refresh warnings for the
  // subcomponent functions colocated there. Do NOT extend this exception to
  // other route files.
  {
    files: ['app/routes/index.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // Node-only scripts: pull in Node globals so `process` / `console` resolve.
  {
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
