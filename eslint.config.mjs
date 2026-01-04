// eslint.config.mjs
import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

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
      },
    },
    rules: {
      '@typescript-eslint/naming-convention': 'error',
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
          ],
          acronyms: ['OK'],
          enforceCamelCaseLower: true,
        },
      ],
      'prefer-const': 'error',
    },
  },
]);
