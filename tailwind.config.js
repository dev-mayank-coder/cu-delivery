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
        cu: {
          dark: '#090D16',
          card: '#111827',
          cardHover: '#162032',
          border: '#1E293B',
          borderHover: '#334155',
          primary: '#10B981',
          primaryHover: '#059669',
          accent: '#6366F1',
          amber: '#F59E0B',
          red: '#EF4444',
          muted: '#94A3B8',
          text: '#F8FAFC',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glow-emerald': '0 0 25px -5px rgba(16, 185, 129, 0.3)',
        'glow-indigo': '0 0 25px -5px rgba(99, 102, 241, 0.3)',
        'glow-purple': '0 0 25px -5px rgba(168, 85, 247, 0.35)',
        'card': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
      }
    },
  },
  plugins: [],
}
