// The bot uses plain CSS (no Tailwind). This local, empty PostCSS config stops
// Next from walking up to the parent Vite app's postcss.config.js.
const config = {
  plugins: {},
};

export default config;
