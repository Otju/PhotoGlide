/** @type {import('tailwindcss').Config} */
export default {
  content: ['./public/**/*.html', './src/**/*.{js,jsx,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        black: '#242424',
        white: '#f5f5f4',
      },
    },
  },
  plugins: [],
}
