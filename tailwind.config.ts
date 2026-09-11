import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#F7F7FB",
        surface: "#FFFFFF",
        field: "#F5F5FA",
        chip: "#EDECFC",
        border: "#E6E6ED",
        primary: "#4E44E5",
        text: "#14141F",
        "text-secondary": "#6B7280",
        income: "#16A34A",
        expense: "#EF4444",
        "budget-green": "#16A34A",
        "budget-yellow": "#EAB308",
        "budget-orange": "#F97316",
        "budget-red": "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "sans-serif"],
      },
      borderRadius: {
        sheet: "28px",
        "card-lg": "20px",
        "card-wallet": "16px",
        control: "14px",
        cell: "5px",
      },
      boxShadow: {
        "mic-glow": "0 8px 20px rgba(78, 68, 229, 0.40)",
      },
    },
  },
  plugins: [],
};

export default config;
