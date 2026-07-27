/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        charcoal: {
          DEFAULT: '#232320',
          soft: '#3a3a36',
        },
        paper: '#faf8f3',
        indigo: {
          DEFAULT: '#5b5d94',
          light: '#8082b8',
          dark: '#454775',
          tint: '#eceafb',
        },
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino Linotype', 'URW Palladio L', 'P052', 'serif'],
        sans: ['ui-sans-serif', 'system-ui', 'Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(35, 35, 32, 0.04), 0 8px 24px -8px rgba(35, 35, 32, 0.12)',
        modal: '0 20px 60px -12px rgba(35, 35, 32, 0.35)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: 0, transform: 'translateY(6px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        'modal-in': {
          from: { opacity: 0, transform: 'scale(0.97) translateY(4px)' },
          to: { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
        'backdrop-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.6s ease-out both',
        'modal-in': 'modal-in 0.2s ease-out both',
        'backdrop-in': 'backdrop-in 0.2s ease-out both',
      },
    },
  },
  plugins: [],
};
