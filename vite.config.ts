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
                main: "src/index.html",
                login: "src/fractal-clock/index.html",
            },
        },
    },
    plugins: [preact()],
})
