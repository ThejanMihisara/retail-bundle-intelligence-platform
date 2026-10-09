export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Arial"],
      },
      colors: {
        "deep": "#080c1a",
        "surface": "#0c1120",
        "elevated": "#111827",
      },
      animation: {
        "spin-gradient": "spin-gradient 1s linear infinite",
        "ping-slow": "ping-slow 1.5s cubic-bezier(0,0,0.2,1) infinite",
      },
      keyframes: {
        "spin-gradient": {
          "0%":   { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "ping-slow": {
          "0%":       { transform: "scale(1)",   opacity: "0.8" },
          "75%, 100%": { transform: "scale(1.8)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
