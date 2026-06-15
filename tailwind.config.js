/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        sidebar: '#1e1e2e',
        'sidebar-light': '#2a2a3e',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
}
