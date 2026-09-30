import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // The app uses an in-JavaScript Vue template, so Vite needs Vue's
  // compiler-enabled browser build rather than the runtime-only build.
  resolve: { alias: { vue: 'vue/dist/vue.esm-bundler.js' } },
});
