const { nodeResolve } = require('@rollup/plugin-node-resolve');
const commonjs = require('@rollup/plugin-commonjs');
const babel = require('@rollup/plugin-babel');
const terser = require('@rollup/plugin-terser');
const postcss = require('rollup-plugin-postcss');

module.exports = {
    input: 'src/index.js',
    output: [
        {
            file: 'dist/chatbot-sdk.js',
            format: 'iife',
            name: 'ChatFlowSDK',
            sourcemap: true
        },
        {
            file: 'dist/chatbot-sdk.min.js',
            format: 'iife',
            name: 'ChatFlowSDK',
            plugins: [terser({
                compress: {
                    drop_console: true,
                    drop_debugger: true
                },
                mangle: {
                    reserved: ['ChatFlowAI']
                }
            })]
        },
        {
            file: 'dist/chatbot-sdk.esm.js',
            format: 'es',
            sourcemap: true
        }
    ],
    plugins: [
        nodeResolve({
            browser: true,
            preferBuiltins: false
        }),
        commonjs(),
        babel.default({
            babelHelpers: 'bundled',
            exclude: 'node_modules/**',
            presets: [
                ['@babel/preset-env', {
                    targets: {
                        browsers: ['> 1%', 'last 2 versions', 'not ie <= 10']
                    },
                    modules: false
                }]
            ]
        }),
        postcss({
            extract: false,
            inject: true,
            minimize: true
        })
    ],
    watch: {
        include: 'src/**',
        clearScreen: false
    }
};