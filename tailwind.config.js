/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: '#e8f1ff',
          100: '#b8d4ff',
          200: '#7aadff',
          300: '#5b93f5',
          400: '#3b7dff',
          500: '#2563eb',
          600: '#1d4fd8',
          700: '#1e293b',
          800: '#131c2e',
          900: '#0a0f1a',
          950: '#060a12',
        },
      },
    },
  },
  plugins: [],
}
