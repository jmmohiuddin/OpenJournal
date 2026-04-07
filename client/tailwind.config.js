/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'alice-blue': '#EDF2FB',
        'lavender-web': '#D7E3FC',
        'blue-eyes': '#ABC4FF',
        'honeydew': '#D6EADF',
        'peach-crayola': '#FFC09F',
        // Semantic color mapping
        'canvas-bg': '#EDF2FB',
        'nav-bg': '#D7E3FC',
        'accent': '#ABC4FF',
        'success': '#D6EADF',
        'alert': '#FFC09F'
      },
      fontFamily: {
        'journal': ['Lora', 'Georgia', 'serif'],
        'system': ['Inter', 'system-ui', 'sans-serif'],
        'serif': ['Lora', 'Georgia', 'serif'],
        'sans': ['Inter', 'system-ui', 'sans-serif']
      },
      backdropBlur: {
        'xs': '2px',
        'glass': '12px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
        'glass-lg': '0 8px 48px 0 rgba(31, 38, 135, 0.12)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    }
  },
  plugins: []
}
