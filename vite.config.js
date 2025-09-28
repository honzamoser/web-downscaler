import { defineConfig } from 'vite'

export default defineConfig({
    root: process.cwd(),
    build: {
        outDir: 'dist',
        assetsDir: 'assets',
        emptyOutDir: true,
    },
    server: {
        port: 3000,
        open: true
    },
    // Set base path for GitHub Pages deployment
    // This ensures assets are loaded from the correct path
    base: process.env.NODE_ENV === 'production' ? '/web-downscaler/' : '/'
})