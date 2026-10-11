/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        brand: {
          indigo: '#3b2f7a',
          magenta: '#b0529a',
          pink: '#f9dfe6',
          sky: '#38bdf8',
          primary: '#38bdf8',
          toxic: '#ef4444',
          safe: '#22c55e',
        },
      },
    },
  },
  plugins: [],
}
