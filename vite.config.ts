import {resolve} from 'node:path'
import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
    root: resolve(__dirname, 'src'),
    build: {
        outDir: resolve(__dirname, 'dist'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                home: resolve(__dirname, 'src/index.html'),
                clock: resolve(__dirname, 'src/fractal-clock/index.html'),
                life: resolve(__dirname, 'src/life-x-time/index.html'),
                hex: resolve(__dirname, 'src/hex-fever/index.html'),
            },
        },
    },
    plugins: [preact()],
})
