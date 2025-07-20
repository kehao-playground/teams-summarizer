const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, 'css-loader'],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'manifest.json', 
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            // Update paths for dist build - preserve the script loading order
            if (manifest.content_scripts && manifest.content_scripts[0]) {
              // Update the paths to remove 'src/' prefix if present
              manifest.content_scripts[0].js = manifest.content_scripts[0].js.map(script => {
                return script.replace(/^src\//, '');
              });
            }
            manifest.background.service_worker = manifest.background.service_worker.replace(/^src\//, '');
            return JSON.stringify(manifest, null, 2);
          }
        },
        { from: 'assets', to: 'assets' },
        { from: 'src/storage', to: 'storage' },
        { from: 'src/api', to: 'api' },
        { from: 'src/export', to: 'export' },
        { from: 'src/prompt', to: 'prompt' },
        { from: 'src/ui', to: 'ui' },
        { from: 'src/utils/*.js', to: 'utils/[name][ext]' },
      ],
    }),
    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
    }),
    new MiniCssExtractPlugin({
      filename: '[name].css',
    }),
  ],
  optimization: {
    minimize: false, // Disable minimization for debugging
  },
};