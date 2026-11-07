// ESLint flat config. typescript-eslint's recommended rules plus a guard that
// keeps the core calculation library pure (see CLAUDE.md: no Date.now(), no
// system timezone, no I/O in src/core).
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['node_modules/', '.next/', 'next-env.d.ts', 'drizzle/meta/', '.scratch/'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Core code is pure: pass time in as a parameter.' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Core code is pure: `new Date()` reads the system clock. Pass time in as a parameter.',
        },
        {
          selector: "CallExpression[callee.property.name=/^(getHours|getDate|getDay|getMonth|getFullYear|getMinutes|getTimezoneOffset|toLocaleString|toLocaleDateString|toLocaleTimeString)$/]",
          message: 'Core code must not use the system timezone. Use Luxon with an explicit IANA zone.',
        },
        {
          selector: "MemberExpression[object.name='DateTime'][property.name='local']",
          message: 'Core code must not use the system timezone. Use Luxon with an explicit IANA zone.',
        },
        {
          selector: "MemberExpression[object.name='DateTime'][property.name='now']",
          message: 'Core code is pure: pass time in as a parameter.',
        },
      ],
      'no-restricted-imports': [
        'error',
        { paths: ['fs', 'node:fs', 'fs/promises', 'node:fs/promises', 'http', 'https', 'node:http', 'node:https', 'pg'] },
      ],
    },
  },
);
