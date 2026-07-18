const path = require('path');

const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = function (options) {
  // Type-check against tsconfig.build.json (spans the repo so prisma/types.ts'
  // PrismaJson global augmentation + the generated @orm/app client are loaded,
  // but excludes specs/tests). The root tsconfig.json intentionally includes
  // specs for the editor + eslint, so the build checker must not use it.
  const configFile = path.resolve(__dirname, 'tsconfig.build.json');

  const plugins = options.plugins.filter(
    (plugin) => plugin.constructor.name !== 'ForkTsCheckerWebpackPlugin',
  );

  plugins.push(
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        configFile,
        memoryLimit: 4096,
      },
      // async:false — the build must FAIL on type errors, not report them after exit 0
      async: false,
      formatter: 'basic',
    }),
  );

  return {
    ...options,
    plugins,
  };
};
