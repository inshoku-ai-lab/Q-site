/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  safelist: [
    // Dynamic category accent classes
    "text-wandering", "text-thought", "text-current", "text-essay", "text-moss", "text-ink",
    "bg-wandering/10", "bg-thought/10", "bg-current/10", "bg-essay/10", "bg-moss/10",
    "bg-wandering/20", "bg-thought/20", "bg-current/20", "bg-essay/20", "bg-moss/20",
    "from-wandering/20", "from-thought/20", "from-current/20", "from-essay/20", "from-moss/20",
    "to-wandering/20", "to-thought/20", "to-current/20", "to-essay/20",
    "border-wandering", "border-thought", "border-current", "border-essay", "border-moss",
    "border-l-wandering", "border-l-thought", "border-l-current", "border-l-essay", "border-l-moss",
    "text-wandering-dark", "text-thought-dark", "text-current-dark", "text-essay-dark",
  ],
  theme: {
    extend: {
      colors: {
        // Natural / earthy palette
        paper: {
          50: "#FBF8F1",  // lightest paper
          100: "#F5F1E8", // main background (washi)
          200: "#EDE7D7",
          300: "#DDD3BB",
        },
        ink: {
          DEFAULT: "#1F1B16", // body text - deep sumi
          light: "#3A352D",
          muted: "#6B6359",
        },
        moss: {
          DEFAULT: "#5B7553", // links - moss green
          dark: "#2C3A2E",    // headings - forest shadow
          light: "#8FA888",
        },
        earth: {
          DEFAULT: "#8B5E3C", // accent - earth/bark
          light: "#B58968",
          dark: "#5C3E27",
        },
        wandering: {
          DEFAULT: "#A6845F",  // 放浪記 accent (warm tan)
          dark: "#6D5036",
        },
        thought: {
          DEFAULT: "#4A5E66",  // 思想・理論 accent (cool slate)
          dark: "#2E3D43",
        },
        current: {
          DEFAULT: "#9C5642",  // 時事・情報戦 accent (rust)
          dark: "#6B3A2C",
        },
        essay: {
          DEFAULT: "#7A7060",  // エッセイ accent (warm gray)
          dark: "#4F4738",
        },
      },
      fontFamily: {
        serif: ['"Noto Serif JP"', '"Newsreader"', "Georgia", "serif"],
        sans: ['"Noto Sans JP"', "Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        // Reading-friendly sizes for Japanese long-form
        body: ["1.0625rem", { lineHeight: "1.9" }],
        "body-lg": ["1.125rem", { lineHeight: "1.95" }],
      },
      maxWidth: {
        prose: "42rem", // ~672px — ideal reading width
        page: "72rem",
      },
      letterSpacing: {
        wider: "0.05em",
      },
    },
  },
  plugins: [],
};
