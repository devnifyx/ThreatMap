import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: path.resolve(__dirname, 'frontend'),
    cacheDir: path.resolve(__dirname, 'vite-cache'),
    plugins: [react()],
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'frontend/index.html'),
                prototype: path.resolve(__dirname, 'frontend/prototype.html'),
            },
        },
    },
});
