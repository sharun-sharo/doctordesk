/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: medical teal #0EA5A4
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0EA5A4',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        // Sage / soft medical green
        sage: {
          50: '#f6f7f6',
          100: '#e3e7e2',
          200: '#c5cfc0',
          300: '#9faf96',
          400: '#7d9172',
          500: '#5f7354',
        },
        // Secondary: soft blue #2563EB
        secondary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563EB',
        },
        surface: {
          DEFAULT: '#F8FAFC',
          card: '#ffffff',
          muted: '#f1f5f9',
        },
        content: {
          DEFAULT: '#1E293B',
          muted: '#64748b',
        },
        success: {
          light: '#d1fae5',
          DEFAULT: '#10B981',
          dark: '#059669',
        },
        warning: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#d97706',
        },
        danger: {
          light: '#fee2e2',
          DEFAULT: '#EF4444',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'display': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700', letterSpacing: '-0.02em' }],
        'h1': ['1.625rem', { lineHeight: '2rem', fontWeight: '600' }], // 26px
        'h2': ['1.125rem', { lineHeight: '1.75rem', fontWeight: '600' }], // 18px
        'h3': ['1.25rem', { lineHeight: '1.875rem', fontWeight: '600' }], // 20px
        'body-lg': ['0.9375rem', { lineHeight: '1.5rem' }], // 15px
        'body': ['0.875rem', { lineHeight: '1.5rem' }], // 14px
        'label': ['0.8125rem', { lineHeight: '1.25rem', fontWeight: '500' }], // 13px
        'caption': ['0.75rem', { lineHeight: '1.125rem', fontWeight: '500' }], // 12px
        'metric': ['2.125rem', { lineHeight: '1.2', fontWeight: '700' }], // 34px
      },
      borderRadius: {
        'card': '0.875rem',
        'xl': '1rem',
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgb(0 0 0 / 0.04)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 2px 6px -2px rgb(0 0 0 / 0.04)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.06), 0 4px 6px -4px rgb(0 0 0 / 0.05)',
        'elevated': '0 12px 24px -8px rgb(0 0 0 / 0.08), 0 4px 12px -4px rgb(0 0 0 / 0.04)',
        'glass': '0 4px 24px -1px rgb(0 0 0 / 0.06)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '30': '7.5rem',
      },
      transitionDuration: {
        '200': '200ms',
        '250': '250ms',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
