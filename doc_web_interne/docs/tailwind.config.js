/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    '../../docs/**/*.html'
  ],
  theme: {
    extend: {
      colors: {
        dream: {
          dark: '#0a0514',
          purple: '#2E1065',
          lavender: '#E9D5FF',
          cream: '#FFF7ED',
          salmon: '#FDA481',
          salmonLight: '#FFCCB5',
          glass: 'rgba(255, 255, 255, 0.03)',
          glassBorder: 'rgba(255, 255, 255, 0.08)',
          accent: '#a855f7'
        }
      },
      fontFamily: {
        serif: ['Fraunces', 'serif'],
        sans: ['Outfit', 'sans-serif'],
      },
      animation: {
        'float': 'float 8s ease-in-out infinite',
        'float-delayed': 'float 12s ease-in-out infinite reverse',
        'pulse-glow': 'pulseGlow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in-up': 'fadeInUp 0.8s ease-out forwards',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.5', transform: 'scale(1)' },
          '50%': { opacity: '0.8', transform: 'scale(1.05)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      }
    }
  },
  plugins: [],
}
