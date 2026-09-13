import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {defineConfig} from 'vite'
import preact from '@preact/preset-vite'

import {projects} from './src/projects'

const repoRoot = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
    root: 'src',
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
    plugins: [preact()],
})
