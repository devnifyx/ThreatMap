import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    root: 'D:/Threat Map/.validation/frontend',
    cacheDir: 'D:/Threat Map/.validation/vite-cache',
    plugins: [react()],
    server: { host: '127.0.0.1', port: 4173, strictPort: true },
    build: {
        outDir: 'D:/Threat Map/.validation/dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'D:/Threat Map/.validation/frontend/index.html',
                prototype: 'D:/Threat Map/.validation/frontend/prototype.html',
            },
        },
    },
});
