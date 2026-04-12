import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // MeepleBase Design Tokens
        amber: {
          DEFAULT: "#E8821A",
          50: "#FDF3E7",
          100: "#FBDFC0",
          200: "#F7C089",
          300: "#F3A152",
          400: "#EF911F",
          500: "#E8821A",
          600: "#C96D12",
          700: "#A8570E",
          800: "#87440A",
          900: "#6A340A",
        },
        slate: {
          DEFAULT: "#1E2A3A",
          50: "#F0F4F8",
          100: "#D9E2EC",
          200: "#BCCCDC",
          300: "#9FB3C8",
          400: "#829AB1",
          500: "#627D98",
          600: "#486581",
          700: "#334E68",
          800: "#243B53",
          900: "#1E2A3A",
          950: "#13202E",
        },
        green: {
          DEFAULT: "#3DB87A",
          50: "#EDFAF3",
          100: "#C8F0DC",
          200: "#92E0BC",
          300: "#5ECF9D",
          400: "#3DB87A",
          500: "#2EA668",
          600: "#228C56",
          700: "#1A6E43",
          800: "#145432",
          900: "#0E3D24",
        },
        // Semantic tokens
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-instrument-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
        card: "16px",
        btn: "8px",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "bounce-gentle": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "slide-up": "slide-up 0.4s ease-out",
        shimmer: "shimmer 1.5s infinite linear",
        "bounce-gentle": "bounce-gentle 2s ease-in-out infinite",
      },
      boxShadow: {
        card: "0 2px 12px rgba(30, 42, 58, 0.08), 0 1px 4px rgba(30, 42, 58, 0.04)",
        "card-hover": "0 8px 24px rgba(30, 42, 58, 0.12), 0 2px 8px rgba(30, 42, 58, 0.06)",
        amber: "0 4px 16px rgba(232, 130, 26, 0.3)",
      },
    },
  },
  plugins: [],
};
export default config;
