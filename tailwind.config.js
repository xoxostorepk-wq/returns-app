/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#161B22',
        paper: '#FAFAF8',
        card: '#FFFFFF',
        line: '#E4E4E1',
        primary: '#0F6E63',
        'primary-dark': '#0B5951',
        status: {
          pending: '#B7791F',
          'pending-bg': '#FBF3E3',
          packed: '#2563AC',
          'packed-bg': '#E7F0FA',
          processed: '#1E7A4C',
          'processed-bg': '#E7F5EC',
          cancelled: '#8A8A85',
          'cancelled-bg': '#EFEFED',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
