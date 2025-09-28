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
    base: "./dist"
})