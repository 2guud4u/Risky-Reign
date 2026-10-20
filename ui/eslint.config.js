import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

/**
 * Replaces Create React App's `react-app` preset. Keeps the two rule families
 * its CI build failed on — unused variables/imports and hook dependency lists —
 * and `npm run build` runs `eslint --max-warnings 0` so warnings still fail.
 */
export default tseslint.config(
  { ignores: ['build', 'node_modules'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-syntax': [
        'error',
        {
          // All buttons go through components/ui/Button (variant="unstyled"
          // is the escape hatch for self-styled chrome).
          selector: 'JSXOpeningElement[name.name="button"]',
          message: 'Use components/ui/Button instead of a raw <button> element.',
        },
        {
          // The token palette (canvas/ink/gold/clay/moss/sky) is the only
          // chrome palette — no Tailwind default color families.
          selector:
            'Literal[value=/(bg|text|border|ring|from|via|to|accent|fill|stroke)-(gray|slate|stone|blue|indigo|red|green|emerald|amber|yellow|purple|pink|rose|orange|cyan|teal|lime|sky-[0-9])/]',
          message: 'Use the token palette (canvas/ink/gold/clay/moss/sky) — no Tailwind default color families.',
        },
        {
          selector:
            'TemplateElement[value.raw=/(bg|text|border|ring|from|via|to|accent|fill|stroke)-(gray|slate|stone|blue|indigo|red|green|emerald|amber|yellow|purple|pink|rose|orange|cyan|teal|lime|sky-[0-9])/]',
          message: 'Use the token palette (canvas/ink/gold/clay/moss/sky) — no Tailwind default color families.',
        },
      ],
    },
  },
  {
    // The primitive implementations themselves may render raw elements and
    // are the only place palette-conditional classes may be authored.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-syntax': 'off' },
  }
);
