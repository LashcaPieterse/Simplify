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
        sans: ["var(--font-dm-sans)", ...fontFamily.sans],
        display: ["var(--font-dm-sans)", ...fontFamily.sans],
        editorial: ["var(--font-instrument-serif)", "Georgia", "serif"]
      },
      fontWeight: { semibold: "600", bold: "650", extrabold: "700", black: "700" },
      borderRadius: { "2xl": "1rem", "3xl": "1.25rem" },
      colors: {
        canvas: "#f8f8f2",
        ink: "#193426",
        accent: { 50: "#f5fae8", 100: "#eaf5c7", 200: "#d9ef82", 300: "#c9e469", 500: "#a9c64d", 700: "#4e6224" },
        brand: {
          50: "#f0f3ee",
          100: "#e0e7dd",
          200: "#c5d0bf",
          300: "#a5b49e",
          400: "#819179",
          500: "#63755e",
          600: "#4b6148",
          700: "#344d37",
          800: "#223c2c",
          900: "#193426",
          950: "#10251b"
        },
        sand: {
          50: "#f8f8f2",
          100: "#f3ecdf",
          200: "#e8d7ba",
          300: "#d8ba91",
          400: "#c69b6b",
          500: "#a76e41",
          600: "#8c5733",
          700: "#70432b",
          800: "#593728",
          900: "#482e23"
        }
      },
      backgroundImage: {
        'radial-fade':
          'radial-gradient(ellipse at top right, rgba(217, 239, 130, 0.16), transparent 60%)'
      },
      boxShadow: {
        subtle: "0 2px 8px -4px rgba(25, 52, 38, 0.12)",
        card: "0 12px 32px -12px rgba(25, 52, 38, 0.16)"
      }
    }
  },
  plugins: []
};

export default config;
