import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

// https://vitejs.dev/config/
export default defineConfig({
    root: 'src',
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                home: "src/index.html",
                clock: "src/fractal-clock/index.html",
                life: "src/3d-life/index.html"
            },
        },
    },
    plugins: [preact()],
})
