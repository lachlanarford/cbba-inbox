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
          purple: 'rgb(var(--accent-rgb) / <alpha-value>)',
          'purple-light': 'rgb(var(--accent-light-rgb) / <alpha-value>)',
          'purple-dark': 'rgb(var(--accent-dark-rgb) / <alpha-value>)',
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
