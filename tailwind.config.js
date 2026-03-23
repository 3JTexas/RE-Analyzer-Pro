/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: '#0D2340', light: '#1a3a5c' },
        brand: {
          orange: '#E07820',
          blue: '#185FA5',
          lblue: '#D6E4F4',
        },
        success: { DEFAULT: '#1D6B3E', light: '#EAF3DE', border: '#97c459' },
        danger:  { DEFAULT: '#A32D2D', light: '#FCEBEB', border: '#f09595' },
        warning: { DEFAULT: '#854F0B', light: '#FAEEDA', border: '#fac775' },
        info:    { DEFAULT: '#185FA5', light: '#D6E4F4', border: '#85b7eb' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
