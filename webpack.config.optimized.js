const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CompressionPlugin = require('compression-webpack-plugin');

const isProduction = process.env.NODE_ENV === 'production';
const analyzeBundle = process.env.ANALYZE_BUNDLE === 'true';

module.exports = {
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? false : 'cheap-module-source-map',
  
  entry: {
    background: './src/background/background.ts',
    content: './src/content/content.ts',
    popup: './src/popup/popup.ts',
    // Performance optimizations
    cacheManager: './src/cacheManager.js',
    memoryOptimizer: './src/memoryOptimizer.js',
    performanceMonitor: './src/performanceMonitor.js',
    uiComponentLoader: './src/uiComponentLoader.js'
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true, // Faster compilation
              compilerOptions: {
                target: 'ES2019', // Modern target for smaller code
                module: 'ES2015',
                moduleResolution: 'node'
              }
            }
          }
        ],
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [
          isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
          {
            loader: 'css-loader',
            options: {
              importLoaders: 1,
              sourceMap: !isProduction
            }
          },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [
                  ['autoprefixer'],
                  ...(isProduction ? [['cssnano', { preset: 'default' }]] : [])
                ]
              }
            }
          }
        ],
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: 'asset',
        parser: {
          dataUrlCondition: {
            maxSize: 8 * 1024, // 8KB - inline small images
          },
        },
        generator: {
          filename: 'assets/images/[name].[hash:8][ext]'
        }
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
        generator: {
          filename: 'assets/fonts/[name].[hash:8][ext]'
        }
      }
    ],
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types')
    },
    // Reduce bundle size by preferring ES modules
    mainFields: ['module', 'browser', 'main']
  },

  output: {
    filename: isProduction ? '[name].[contenthash:8].js' : '[name].js',
    chunkFilename: isProduction ? 'chunks/[name].[contenthash:8].js' : 'chunks/[name].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    // Optimize for extension environment
    environment: {
      arrowFunction: true,
      const: true,
      destructuring: true,
      forOf: true,
      module: true
    }
  },

  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        { 
          from: 'manifest.json', 
          to: 'manifest.json',
          transform(content) {
            const manifest = JSON.parse(content.toString());
            
            // Production optimizations for manifest
            if (isProduction) {
              // Remove development permissions
              if (manifest.permissions) {
                manifest.permissions = manifest.permissions.filter(
                  perm => !['debugger', 'management'].includes(perm)
                );
              }
              
              // Add performance optimizations
              if (manifest.content_scripts) {
                manifest.content_scripts.forEach(script => {
                  script.run_at = script.run_at || 'document_idle';
                });
              }
            }
            
            return JSON.stringify(manifest, null, isProduction ? 0 : 2);
          }
        },
        { 
          from: 'assets', 
          to: 'assets',
          globOptions: {
            ignore: isProduction ? ['**/*.psd', '**/*.ai', '**/*.sketch'] : []
          }
        },
      ],
    }),

    new HtmlWebpackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
      minify: isProduction ? {
        removeComments: true,
        collapseWhitespace: true,
        removeRedundantAttributes: true,
        useShortDoctype: true,
        removeEmptyAttributes: true,
        removeStyleLinkTypeAttributes: true,
        keepClosingSlash: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true
      } : false
    }),

    new MiniCssExtractPlugin({
      filename: isProduction ? '[name].[contenthash:8].css' : '[name].css',
      chunkFilename: isProduction ? 'chunks/[name].[contenthash:8].css' : 'chunks/[name].css'
    }),

    // Production optimizations
    ...(isProduction ? [
      new CompressionPlugin({
        test: /\.(js|css|html|svg)$/,
        threshold: 8192, // Only compress files larger than 8KB
        minRatio: 0.8
      })
    ] : []),

    // Bundle analyzer for optimization insights
    ...(analyzeBundle ? [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        openAnalyzer: false,
        reportFilename: 'bundle-report.html'
      })
    ] : [])
  ],

  optimization: {
    minimize: isProduction,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            drop_console: isProduction, // Remove console.log in production
            drop_debugger: true,
            pure_funcs: isProduction ? ['console.log', 'console.info', 'console.warn'] : [],
            passes: 2 // Multiple passes for better compression
          },
          mangle: {
            safari10: true // Fix Safari 10 compatibility
          },
          format: {
            comments: false
          }
        },
        extractComments: false
      }),
      new CssMinimizerPlugin({
        minimizerOptions: {
          preset: [
            'default',
            {
              discardComments: { removeAll: true },
              normalizeWhitespace: true,
              colormin: true,
              convertValues: true,
              discardDuplicates: true,
              discardEmpty: true,
              mergeRules: true,
              minifyFontValues: true,
              minifySelectors: true
            }
          ]
        }
      })
    ],

    // Code splitting for better caching
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        // Vendor libraries
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 20
        },
        // Common utilities
        common: {
          name: 'common',
          minChunks: 2,
          chunks: 'all',
          priority: 10,
          reuseExistingChunk: true
        },
        // Performance modules
        performance: {
          test: /[\\/]src[\\/](cacheManager|memoryOptimizer|performanceMonitor|uiComponentLoader)\.js$/,
          name: 'performance',
          chunks: 'all',
          priority: 15
        }
      }
    },

    // Tree shaking and side effects
    usedExports: true,
    sideEffects: [
      '*.css',
      '*.scss',
      './src/polyfills.js'
    ],

    // Module concatenation for smaller bundles
    concatenateModules: isProduction
  },

  // Performance hints
  performance: {
    hints: isProduction ? 'warning' : false,
    maxEntrypointSize: 512000, // 500KB
    maxAssetSize: 256000 // 250KB
  },

  // Development server optimization
  ...(isProduction ? {} : {
    cache: {
      type: 'filesystem',
      buildDependencies: {
        config: [__filename]
      }
    }
  }),

  // External dependencies to reduce bundle size
  externals: {
    // Chrome APIs are available globally
    chrome: 'chrome'
  },

  // Target optimization for Chrome extensions
  target: ['web', 'es2019'],

  // Stats configuration for build analysis
  stats: {
    preset: 'minimal',
    moduleTrace: true,
    errorDetails: true,
    chunks: false,
    chunkModules: false,
    chunkOrigins: false,
    colors: true,
    ...(isProduction ? {
      optimizationBailout: true,
      providedExports: true,
      usedExports: true
    } : {})
  }
};