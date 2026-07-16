/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0b10',
          card: '#121420',
          border: '#1f2438',
          accent: '#3b82f6',
          neonBlue: '#00f0ff',
          neonPink: '#ff007f',
          neonGreen: '#39ff14',
          neonGold: '#ffd700'
        }
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}
