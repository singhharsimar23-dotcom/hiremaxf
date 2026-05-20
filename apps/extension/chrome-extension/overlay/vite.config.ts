import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    define: {
        'process.env': {}
    },
    build: {
        outDir: '../dist/overlay',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                overlay: resolve(__dirname, 'src/main.tsx'), // Direct JS entry
            },
            output: {
                entryFileNames: 'overlay.js', // Fixed name
                assetFileNames: 'overlay.[ext]', // Fixed name for CSS
                format: 'iife' // Immediately Invoked Function Expression for direct script injection
            }
        },
    },
})
