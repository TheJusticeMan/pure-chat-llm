// eslint.config.mjs
import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import jsdoc from 'eslint-plugin-jsdoc';

export default defineConfig([
  {
    ignores: ['main.js', 'node_modules/**', 'dist/**', 'package.json'],
  },
  ...obsidianmd.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { project: './tsconfig.json' },
      globals: {
        ...globals.browser,
        ...globals.node,
        NodeJS: 'readonly',
        createFragment: 'readonly',
        createEl: 'readonly',
        createDiv: 'readonly',
        createSpan: 'readonly',
        createSvg: 'readonly',
      },
    },
    plugins: {
      jsdoc,
    },
    rules: {
      /* '@typescript-eslint/naming-convention': 'error', */
      'obsidianmd/ui/sentence-case': [
        'error',
        {
          brands: [
            'LLM',
            'PureChatLLM',
            'API',
            'Pure Chat LLM',
            'OpenAI',
            'ChatGPT',
            'DALL-E',
            'api.openai.com',
            'HTML',
            'YAML',
            'AI',
          ],
          acronyms: ['OK'],
          enforceCamelCaseLower: true,
        },
      ],
      'jsdoc/require-jsdoc': [
        'error',
        {
          require: {
            FunctionDeclaration: true,
            MethodDefinition: true,
            ClassDeclaration: true,
            ArrowFunctionExpression: false,
            FunctionExpression: false,
          },
        },
      ],
      'jsdoc/require-param-description': 'warn',
      'jsdoc/require-returns-description': 'warn',
      'jsdoc/check-param-names': 'error',
      'jsdoc/require-param': 'error',
      'jsdoc/require-returns': 'error',
      'prefer-const': 'error',
    },
  },
]);
