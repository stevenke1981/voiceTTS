/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // 主色調：深色系 UI
        surface: {
          50: "#f8f7f7",
          100: "#f0eeee",
          200: "#e4e0e0",
          300: "#ccc7c7",
          400: "#ada4a4",
          500: "#8a7f7f",
          600: "#6e6363",
          700: "#5a5050",
          800: "#2a2424",
          900: "#1a1515",
          950: "#0f0c0c",
        },
        accent: {
          DEFAULT: "#7c6ff7",
          light: "#a99bf9",
          dark: "#5a4ee0",
        },
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans TC", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.2s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
        shimmer: "shimmer 1.5s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        shimmer: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(300%)" },
        },
      },
    },
  },
  plugins: [],
};
