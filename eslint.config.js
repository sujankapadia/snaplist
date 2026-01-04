import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  // Recommended base config
  js.configs.recommended,

  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.es2021,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
    },

    rules: {
      // React recommended rules
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,

      // React settings
      'react/react-in-jsx-scope': 'off', // Not needed with React 17+
      'react/prop-types': 'off', // We're not using PropTypes

      // General JavaScript rules
      'no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-console': 'off', // Allow console.log for debugging
      'prefer-const': 'warn',
      'no-var': 'error',
    },

    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Ignore build output and dependencies
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.netlify/**',
      '.playwright-mcp/**',
      'gemini-changes/**', // Reference files from Gemini Canvas
    ],
  },
];
