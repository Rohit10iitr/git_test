/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mta: {
          blue: '#0039A6',
          orange: '#FF6319',
          yellow: '#FCCC0A',
          green: '#00933C',
          red: '#EE352E',
          purple: '#B933AD',
          gray: '#6D6E71',
        },
        bus: {
          DEFAULT: '#1D7FBF',
          light: '#E8F4FD',
          border: '#9BCDE6',
        },
        subway: {
          DEFAULT: '#555',
          light: '#F3F3F3',
          border: '#CCC',
        },
        rail: {
          DEFAULT: '#003E9B',
          light: '#E6ECF8',
          border: '#96B0E0',
        },
        walk: {
          DEFAULT: '#6B7280',
          light: '#F9FAFB',
          border: '#D1D5DB',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
