/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Warm cream canvas — the game's "table". Every surface sits on this.
        canvas: {
          DEFAULT: '#faf6ef',
          raised: '#fdfaf4',
          sunken: '#f2ead8',
        },
        // Warm ink — replaces gray for text. Softer than pure black, warmer
        // than slate.
        ink: {
          DEFAULT: '#2d2520',
          soft: '#5c5248',
          faint: '#9b9183',
        },
        // Gold — the primary accent. Buttons, highlights, "this is yours".
        gold: {
          DEFAULT: '#d4a017',
          deep: '#b8860b',
          soft: '#e8c547',
          pale: '#fdf2d0',
        },
        // Terracotta — warm secondary, used for warnings/warm states.
        clay: {
          DEFAULT: '#c06b4a',
          soft: '#d98f72',
          pale: '#fbe8de',
        },
        // Moss — warm green for success/go states.
        moss: {
          DEFAULT: '#6b8e4e',
          soft: '#8fae6f',
          pale: '#eef4e4',
        },
        // Sky — warm blue for info/neutral accents.
        sky: {
          DEFAULT: '#4a7ea8',
          soft: '#6f9fc4',
          pale: '#e3f0f8',
        },
      },
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
