import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gray-50': '#fafafa',
        'gray-100': '#f5f5f5',
        'gray-200': '#e5e5e5',
        'gray-300': '#d4d4d4',
        'gray-400': '#a3a3a3',
        'gray-500': '#737373',
        'gray-600': '#525252',
        'gray-700': '#404040',
        'gray-800': '#262626',
        'gray-900': '#171717',
        // The Tally: ink, paper and mist. The old emerald accent maps onto ink and mist, so every
        // "emerald" in the app now draws in the identity (no green anywhere; filmed is shown by form).
        'umanity': {
          50: '#F2F5F5',
          100: '#E8EDEE',
          200: '#D9E1E2',
          300: '#B9C4C6',
          400: '#7D898C',
          500: '#111111',
          600: '#111111',
          700: '#111111',
          800: '#000000',
          900: '#000000',
          950: '#000000',
        },
        emerald: {
          50: '#F2F5F5',
          100: '#E8EDEE',
          200: '#D9E1E2',
          300: '#B9C4C6',
          400: '#7D898C',
          500: '#111111',
          600: '#111111',
          700: '#111111',
          800: '#000000',
          900: '#000000',
          950: '#000000',
        },
      },
      boxShadow: {
        'soft': '0 1px 4px rgba(0,0,0,0.03)',
        'lifted': '0 2px 12px rgba(0,0,0,0.04)',
        'elevated': '0 8px 32px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.02)',
        'glow': '0 0 0 1px rgba(17,17,17,0.08)',
        'glow-lg': '0 0 0 1px rgba(17,17,17,0.12)',
        'whale': '0 0 0 1px rgba(17,17,17,0.1)',
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.19, 1, 0.22, 1)',
      },
      animation: {
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'fade-in': 'fadeIn 0.4s ease-out',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'ticker': 'ticker 30s linear infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'orb-breathe': 'orbBreathe 3s ease-in-out infinite',
      },
      keyframes: {
        ticker: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.6', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
        },
        orbBreathe: {
          '0%, 100%': { transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { transform: 'scale(1.08)', filter: 'brightness(1.15)' },
        },
      },
      borderRadius: {
        'apple': '20px',
      },
      fontFamily: {
        sans: ['var(--font-anek)', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['var(--font-martian)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
