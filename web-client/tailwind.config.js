/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#0f172a',
          primary: '#6366f1',
          toxic: '#ef4444',
          safe: '#22c55e'
        }
      }
    },
  },
  plugins: [],
}
