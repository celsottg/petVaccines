module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Lets Metro bundle the Drizzle `.sql` migration files as strings.
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
