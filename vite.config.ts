import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                home: "src/index.html",
                clock: "src/fractal-clock/index.html",
                life: "src/life-x-time/index.html",
                hex: "src/hex-fever/index.html",
            },
        },
    },
    plugins: [preact()],
})
