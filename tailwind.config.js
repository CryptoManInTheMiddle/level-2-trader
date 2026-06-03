/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        base: '#0B0E11',
        surface: '#151A21',
        'surface-2': '#1C232C',
        border: '#252D38',
        // Market
        bid: '#16C784',
        ask: '#EA3943',
        'bid-dim': 'rgba(22, 199, 132, 0.14)',
        'ask-dim': 'rgba(234, 57, 67, 0.14)',
        // Accent / XP
        accent: '#5B8DEF',
        violet: '#7C5CFC',
        // Text
        ink: '#E8EAED',
        muted: '#8A93A0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'ui-monospace', 'monospace'],
      },
      keyframes: {
        flashUp: {
          '0%': { backgroundColor: 'rgba(22, 199, 132, 0.45)' },
          '100%': { backgroundColor: 'transparent' },
        },
        flashDown: {
          '0%': { backgroundColor: 'rgba(234, 57, 67, 0.45)' },
          '100%': { backgroundColor: 'transparent' },
        },
      },
      animation: {
        flashUp: 'flashUp 0.45s ease-out',
        flashDown: 'flashDown 0.45s ease-out',
      },
    },
  },
  plugins: [],
};
