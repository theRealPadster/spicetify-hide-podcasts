import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      // Vendored from spicetify-cli via `pnpm update-types` — not ours to lint
      'src/types/spicetify.d.ts',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    // No `globals` config needed: every source file is TypeScript, and
    // typescript-eslint turns `no-undef` off for TS (tsc already checks it).
    rules: {
      // NOTE: these core formatting rules are deprecated upstream but still
      // shipped and functional in ESLint 10. If a future major drops them,
      // swap in @stylistic/eslint-plugin with the same options.
      'indent': ['error', 2],
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],
      'no-var': 'error',
      'space-before-blocks': 'error',
      'comma-spacing': ['error', { 'before': false, 'after': true }],
      'no-trailing-spaces': 'error',
      'keyword-spacing': 'error',
      'no-multiple-empty-lines': ['error', { 'max': 1 }],
      'object-curly-spacing': ['error', 'always'],
      'key-spacing': ['error', { 'beforeColon': false, 'afterColon': true }],
    },
  },
);
