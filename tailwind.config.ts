import type { Config } from "tailwindcss";
import { fontFamily } from "tailwindcss/defaultTheme";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [...fontFamily.sans],
        display: [...fontFamily.sans]
      },
      colors: {
        brand: {
          50: "#f3fbfb",
          100: "#e5f7f6",
          200: "#c2ebeb",
          300: "#8ad8d6",
          400: "#58c4c1",
          500: "#2dabac",
          600: "#1f8789",
          700: "#1c6b6d",
          800: "#1a5658",
          900: "#153f41"
        },
        sand: {
          50: "#fff9f2",
          100: "#ffeeda",
          200: "#ffd4a1",
          300: "#ffbe73",
          400: "#f89f3c",
          500: "#e17e16",
          600: "#b55d0d",
          700: "#8c460c",
          800: "#6b360d",
          900: "#552c0e"
        }
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(circle at top left, rgba(45, 171, 172, 0.2), transparent 55%), radial-gradient(circle at bottom right, rgba(248, 159, 60, 0.22), transparent 55%)'
      },
      boxShadow: {
        subtle: "0 20px 45px -25px rgba(12, 62, 73, 0.45)",
        card: "0 20px 40px -18px rgba(19, 49, 56, 0.45)"
      }
    }
  },
  plugins: []
};

export default config;
