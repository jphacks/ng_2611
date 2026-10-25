import { defineConfig } from 'vite';
import { stageSavePlugin } from '../scripts/stage-save-plugin.mjs';

export default defineConfig({
  plugins: [stageSavePlugin()],
  server: {
    host: '127.0.0.1',
  },
});
