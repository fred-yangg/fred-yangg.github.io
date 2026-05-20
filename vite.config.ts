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
                home: "index.html",
                clock: "fractal-clock/index.html",
                life: "life-x-time/index.html",
                hex: "hex-fever/index.html",
            },
        },
    },
    plugins: [preact()],
})
