/* eslint @typescript-eslint/explicit-function-return-type: "off" */
/* eslint @typescript-eslint/no-var-requires: "off" */

const path = require('path');
const webpack = require('webpack');
const nodeExternals = require('webpack-node-externals');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');

module.exports = {
  mode: isProduction() ? 'production' : 'development',
  target: 'node',
  devtool: isProduction() ? 'none' : 'cheap-source-map',
  resolve: {
    extensions: ['.ts', '.js', '.json'],
  },
  entry: {
    main: './src/bin/index.ts',
    parse: './src/bin/parse.ts',
  },
  externals: [nodeExternals()],
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    publicPath: '',
  },
  module: {
    rules: [
      {
        enforce: 'pre',
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'eslint-loader',
      },
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
        },
      },
      // { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }
    ],
  },
  plugins: [
    new ForkTsCheckerWebpackPlugin(),
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
  ],
};

function isProduction() {
  return process.env.NODE_ENV === 'production';
}
