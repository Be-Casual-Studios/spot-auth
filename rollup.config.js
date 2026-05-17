import { defineConfig } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

const external = ['react', 'react-dom', 'react-router-dom', 'react/jsx-runtime', 'open', 'fs', 'path', 'http', 'url'];

const entries = [
  { input: 'src/core/SpotAuth.js',       output: 'dist/core/SpotAuth.cjs' },
  { input: 'src/node/index.js',          output: 'dist/node/index.cjs' },
  { input: 'src/react/index.js',         output: 'dist/react/index.cjs' },
  { input: 'src/react-router/index.jsx', output: 'dist/react-router/index.cjs' },
];

export default defineConfig(
  entries.map(({ input, output }) => ({
    input,
    external,
    plugins: [
      esbuild({ jsx: 'automatic' }),
    ],
    output: {
      file: output,
      format: 'cjs',
      exports: 'named',
    },
  }))
);
