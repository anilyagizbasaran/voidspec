/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        panel: {
          bg: '#0d1117',
          surface: '#161b22',
          'surface-2': '#1c2128',
          border: '#30363d',
          'border-light': '#3d444d',
          hover: '#21262d',
          accent: '#58a6ff',
          'accent-dim': 'rgba(88,166,255,0.12)',
          green: '#3fb950',
          'green-dim': 'rgba(63,185,80,0.12)',
          red: '#f85149',
          'red-dim': 'rgba(248,81,73,0.12)',
          yellow: '#d29922',
          'yellow-dim': 'rgba(210,153,34,0.12)',
          cyan: '#39c5cf',
          'cyan-dim': 'rgba(57,197,207,0.12)',
          text: '#e6edf3',
          muted: '#7d8590',
          'muted-2': '#656d76',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.6' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.25s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
};
