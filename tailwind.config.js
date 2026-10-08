/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Boxed2Built brand: the gold of the logo's "2" and the site's navy.
        brand: {
          navy: '#1E3A8A',
          'navy-dark': '#172C6B',
          gold: '#ECB045',
          'gold-light': '#FDF3E0',
          'gold-dark': '#6B4708',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      fontWeight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  },
  plugins: [],
};
