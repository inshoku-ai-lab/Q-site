/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  safelist: [
    // Dynamic category accent classes
    "text-wandering", "text-thought", "text-current", "text-essay", "text-bitcoin", "text-moss", "text-ink",
    "bg-wandering/10", "bg-thought/10", "bg-current/10", "bg-essay/10", "bg-bitcoin/10", "bg-moss/10",
    "bg-wandering/20", "bg-thought/20", "bg-current/20", "bg-essay/20", "bg-bitcoin/20", "bg-moss/20",
    "from-wandering/20", "from-thought/20", "from-current/20", "from-essay/20", "from-bitcoin/20", "from-moss/20",
    "to-wandering/20", "to-thought/20", "to-current/20", "to-essay/20", "to-bitcoin/20",
    "border-wandering", "border-thought", "border-current", "border-essay", "border-bitcoin", "border-moss",
    "border-l-wandering", "border-l-thought", "border-l-current", "border-l-essay", "border-l-bitcoin", "border-l-moss",
    "text-wandering-dark", "text-thought-dark", "text-current-dark", "text-essay-dark", "text-bitcoin-dark",
  ],
  theme: {
    extend: {
      colors: {
        // Natural / earthy palette (v2 — Claude Design homepage handoff)
        paper: {
          50: "#F4DCB2",  // card / raised-surface background (warm amber)
          100: "#F6EFDC", // main background (washi)
          200: "#F5E5C7",
          300: "#D9D2C0",
        },
        ink: {
          DEFAULT: "#2A1F11", // body text
          light: "#4A3A22",
          muted: "#6E6048",   // darkened from #79694F for WCAG AA on card backgrounds
        },
        moss: {
          DEFAULT: "#4F6B43", // links, inline accent
          dark: "#3D5434",    // hover / emphasis
          light: "#59744C",   // primary buttons, dots (darkened from #6D8E5D for AA button-text contrast)
        },
        earth: {
          DEFAULT: "#8A3D1F", // accent - warm orange
          light: "#B5602E",
          dark: "#5C2814",
        },
        wandering: {
          DEFAULT: "#846849",  // 放浪記 accent (warm tan, darkened from #A6845F for AA)
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
          DEFAULT: "#746B5C",  // エッセイ accent (warm gray, darkened from #7A7060 for AA)
          dark: "#4F4738",
        },
        bitcoin: {
          DEFAULT: "#8A6719",  // ビットコインの真実 accent (gold, darkened from #A67C1E for AA)
          dark: "#6B5414",
        },
      },
      fontFamily: {
        serif: ['"Shippori Mincho B1"', '"Noto Serif JP"', "Georgia", "serif"],
        sans: ['"Zen Kaku Gothic New"', '"Noto Sans JP"', "Inter", "system-ui", "sans-serif"],
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
      borderRadius: {
        lg: "1rem",    // 16px — cards (was 8px)
        xl: "1.5rem",  // 24px — hero imagery (was 12px)
      },
    },
  },
  plugins: [],
};
