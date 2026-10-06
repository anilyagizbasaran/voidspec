/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#1b2229',
          surface: '#222a32',
          'surface-2': '#29323b',
          border: '#36414c',
          'border-light': '#4a5662',
          hover: '#2c353f',
          accent: '#d8cfbd',
          'accent-dim': 'rgba(216, 207, 189, 0.12)',
          green: '#3fcf6b',
          'green-dim': 'rgba(63, 207, 107, 0.12)',
          red: '#ef5a50',
          'red-dim': 'rgba(239, 90, 80, 0.12)',
          yellow: '#eea53b',
          'yellow-dim': 'rgba(238, 165, 59, 0.12)',
          cyan: '#63bfd8',
          'cyan-dim': 'rgba(99, 191, 216, 0.12)',
          text: '#e4e8eb',
          muted: '#95a0aa',
          'muted-2': '#6e7a86',
        },
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'Consolas', 'monospace'],
        sans: ['"IBM Plex Sans Condensed"', 'system-ui', 'sans-serif'],
        chrome: ['"IBM Plex Sans Condensed"', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out',
      },
    },
  },
  plugins: [],
};
