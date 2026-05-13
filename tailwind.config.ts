import type { Config } from 'tailwindcss'

const config: Config = {
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
          navy: '#21222C',
          'navy-light': '#2c2d3a',
          'navy-dark': '#181920',
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
