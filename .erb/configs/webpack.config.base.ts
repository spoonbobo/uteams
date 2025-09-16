/**
 * Base webpack config used across other specific configs
 */

import path from 'path';
import webpack from 'webpack';
import TsconfigPathsPlugins from 'tsconfig-paths-webpack-plugin';
import webpackPaths from './webpack.paths';
import { dependencies as externals } from '../../release/app/package.json';

const configuration: webpack.Configuration = {
  externals: [...Object.keys(externals || {})],

  stats: 'errors-only',

  module: {
    rules: [
      {
        test: /\.[jt]sx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'ts-loader',
          options: {
            // Remove this line to enable type checking in webpack builds
            transpileOnly: true,
            compilerOptions: {
              module: 'nodenext',
              moduleResolution: 'nodenext',
            },
          },
        },
      },
    ],
  },

  output: {
    path: webpackPaths.srcPath,
    // https://github.com/webpack/webpack/issues/1114
    library: { type: 'commonjs2' },
  },

  /**
   * Determine the array of extensions that should be used to resolve modules.
   */
  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [webpackPaths.srcPath, 'node_modules'],
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      '@/components': path.resolve(__dirname, '../../src/renderer/components'),
      '@/stores': path.resolve(__dirname, '../../src/renderer/stores'),
      '@/views': path.resolve(__dirname, '../../src/renderer/views'),
      '@/utils': path.resolve(__dirname, '../../src/renderer/utils'),
      '@/types': path.resolve(__dirname, '../../src/renderer/types'),
      '@/main': path.resolve(__dirname, '../../src/main'),
    },
    // Keep the TsconfigPathsPlugin as backup
    plugins: [new TsconfigPathsPlugins({
      configFile: path.resolve(__dirname, '../../tsconfig.json')
    })],
  },

  plugins: [new webpack.EnvironmentPlugin({ NODE_ENV: 'production' })],
};

export default configuration;
