import {projects} from '../projects.ts'

import './app.css'

export function App() {
    return (
        <>
            <h1>Fred Yang</h1>
            <h4>I like making stuff</h4>

            {projects.map((project) => (
                <div key={project.slug}>
                    <a href={`${project.slug}/`}>{project.title}</a>
                </div>
            ))}
        </>
    )
}
