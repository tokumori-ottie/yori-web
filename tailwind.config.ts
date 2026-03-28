import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        yori: {
          base: '#FAF8F5',
          bg: '#F5F0EB',
          card: '#EDE5DC',
          accent: '#8B6F5E',
          'accent-dark': '#5C4F46',
          text: '#4A3D36',
          muted: '#9A8880',
          'very-muted': '#B5A89E',
          border: '#D4C5BC',
          'light-border': '#E8E2DA',
          avatar: '#C9B8AC',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'Hiragino Sans',
          'Noto Sans JP',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
}

export default config
