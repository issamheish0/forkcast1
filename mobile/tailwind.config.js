/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#FAF7F2",
        foreground: "#5A1E32",
        primary: { DEFAULT: "#7A2342", foreground: "#FFFFFF" },
        secondary: { DEFAULT: "#FBE6D6", foreground: "#5A1E32" },
        muted: { DEFAULT: "#F2EBE3", foreground: "#7A6A6E" },
        accent: { DEFAULT: "#D5B4D5", foreground: "#5A1E32" },
        border: "#E7DACD",
        card: { DEFAULT: "#FFFFFF", foreground: "#5A1E32" },
        destructive: { DEFAULT: "#DC2626", foreground: "#FFFFFF" },
        success: { DEFAULT: "#16A34A", foreground: "#FFFFFF" },
        warning: { DEFAULT: "#EAB308", foreground: "#1F2937" },
      },
    },
  },
  plugins: [],
};
