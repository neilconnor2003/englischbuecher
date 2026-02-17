module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.module.rules = webpackConfig.module.rules.map(rule => {
        if (rule.test && rule.test.toString().includes('css')) {
          rule.exclude = [
            /node_modules\/.*tailwindcss/,
            /tailwindcss\/lib/,
            /node_modules\/tailwindcss\/lib\/index\.js/,
          ];
        }
        return rule;
      });
      webpackConfig.module.rules.push({
        test: /node_modules\/tailwindcss\/lib\/index\.js/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      });
      return webpackConfig;
    },
  },
};