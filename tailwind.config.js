/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        main: "#0a0a0a",
        secondary: "#121212",
        "border-subtle": "#262626",
      },
    },
  },
  plugins: [],
};
