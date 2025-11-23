import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}", 
    "./components/**/*.{ts,tsx}", 
    "./app/**/*.{ts,tsx}", 
    "./src/**/*.{ts,tsx}",
    "./biblio-ui-design/src/components/**/*.{ts,tsx}"
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        // Core color system
        ink: "#0B1220",
        body: "#2A3140", 
        muted: "#5B6575",
        border: "#E6E9EF",
        surface: "#FFFFFF",
        
        // Primary/Accent
        primary: {
          DEFAULT: "#111827",
          hover: "#0C1424",
          foreground: "#FFFFFF",
        },
        
        // Tags
        tag: {
          bg: "#FFF7E6",
          text: "#7A5E2E",
        },
        
        // Success & Neutral
        success: "#22C55E",
        neutral: "#CBD5E1",
        
        // Compatibility aliases
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        xl: "16px",  // Cards
        lg: "12px",  // Inputs
        md: "10px",  // Buttons
        card: "var(--radius-card)",
        input: "var(--radius-input)",
        button: "var(--radius-button)",
      },
      maxWidth: {
        container: "1120px",
      },
      boxShadow: {
        card: "0 10px 25px rgba(16, 24, 40, 0.06)",
        popover: "0 12px 32px rgba(16, 24, 40, 0.12)",
        hover: "0 16px 32px rgba(16, 24, 40, 0.1)",
      },
      backgroundImage: {
        'site-gradient':
          'radial-gradient(1200px 600px at 15% 10%, #FFF5E6 0%, transparent 50%), radial-gradient(1000px 500px at 85% 30%, #F3F8FF 0%, transparent 50%)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "fade-up": "fade-up 0.6s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
