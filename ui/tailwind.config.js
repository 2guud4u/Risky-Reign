import { colors } from './src/theme.js';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors,
      borderRadius: {
        // Playful, consistent roundness: chips stay pill, cards stay soft.
        sm: '0.375rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
      },
      fontFamily: {
        // System stack leaning warm — no web font dep yet, just a nicer fallback order.
        sans: [
          'ui-rounded',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      boxShadow: {
        // Softer, warmer shadows than the default gray.
        card: '0 1px 3px rgba(45,37,32,0.08), 0 4px 12px rgba(45,37,32,0.06)',
        pop: '0 4px 12px rgba(45,37,32,0.12), 0 12px 32px rgba(45,37,32,0.10)',
        glow: '0 0 0 3px rgba(212,160,23,0.35)',
      },
      transitionDuration: {
        // Snappy defaults for UI feel; springs handle the bouncy stuff.
        fast: '120ms',
        base: '200ms',
        slow: '320ms',
      },
    },
  },
  plugins: [],
};
