module.exports = {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': {},
    '@tailwindcss/postcss': {
      config: './tailwind.config.ts'
    },
    autoprefixer: {},
  }
};
