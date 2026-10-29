import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./site/', import.meta.url)),
  server: { port: Number(process.env.PORT) || 8000, strictPort: true },
  preview: { port: Number(process.env.PORT) || 8000, strictPort: true },
  build: {
    outDir: fileURLToPath(new URL('./dist/site/', import.meta.url)),
    emptyOutDir: true,
  },
});
