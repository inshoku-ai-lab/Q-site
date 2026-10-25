// Tailwind runs through Vite's PostCSS step. @astrojs/tailwind did the same
// but does not support Astro 6+, so it is configured here directly; the
// @tailwind directives live in src/styles/global.css (the integration was
// already used with applyBaseStyles: false, so nothing else changes).
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
