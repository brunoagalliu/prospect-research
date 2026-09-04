/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        ink: {
          50: '#f5f6f8',
          100: '#eceef2',
          200: '#d8dce3',
          300: '#b7bec9',
          400: '#8991a1',
          500: '#666f81',
          600: '#4c5566',
          700: '#3a4150',
          800: '#262b36',
          900: '#191d25',
        },
        brand: {
          50: '#fdf5e9',
          100: '#faeaca',
          200: '#f3d38f',
          300: '#eabb5c',
          400: '#dda038',
          500: '#bd7f22',
          600: '#98651b',
          700: '#764e17',
        },
        signal: {
          light: '#fbe9e6',
          DEFAULT: '#c1554a',
          dark: '#8f3c33',
        },
        good: {
          light: '#e3f3ef',
          DEFAULT: '#2f8f76',
          dark: '#1f6350',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(25, 29, 37, 0.04), 0 1px 8px rgba(25, 29, 37, 0.04)',
      },
    },
  },
  plugins: [],
};
