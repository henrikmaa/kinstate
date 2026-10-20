const { transformAsync } = require('@babel/core');

module.exports = function kinstateLoader(source, inputMap) {
  const done = this.async();
  Promise.all([import('@kinstate/compiler'), import('@babel/preset-typescript')])
    .then(([compiler, typescript]) =>
      transformAsync(source, {
        filename: this.resourcePath,
        configFile: false,
        babelrc: false,
        sourceMaps: true,
        inputSourceMap: inputMap || undefined,
        presets: [[typescript.default, { allExtensions: true, isTSX: true }]],
        plugins: [compiler.default],
      }),
    )
    .then((result) => done(null, result.code, result.map), done);
};
