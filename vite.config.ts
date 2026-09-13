import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

import {projects} from './src/projects'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    root: 'src',
    publicDir: path.join(repoRoot, 'public'),
    build: {
        outDir: '../dist',
        emptyOutDir: true,
        rolldownOptions: {
            input: {
                home: path.join(repoRoot, 'src/index.html'),
                ...Object.fromEntries(
                    projects.map((project) => [
                        project.slug,
                        path.join(repoRoot, 'src', project.slug, 'index.html'),
                    ]),
                ),
            },
        },
    },
    plugins: [react()],
})
