import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        cbba: {
          purple: '#604484',
          'purple-light': '#7a5a9e',
          'purple-dark': '#4a3368',
          gold: '#FBB33F',
          navy: 'var(--cbba-navy)',
          'navy-light': 'var(--cbba-navy-light)',
          'navy-dark': 'var(--cbba-navy-dark)',
          orange: '#F58945',
        },
      },
      fontFamily: {
        sans: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
