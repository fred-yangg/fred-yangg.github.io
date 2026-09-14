import {projects} from '../projects.ts'

export function App() {
    return (
        <>
            <h1 className="text-[3.2em] leading-[1.1] font-normal">Fred Yang</h1>
            <h4>I like making stuff</h4>

            {projects.map((project) => (
                <div key={project.slug}>
                    <a
                        className="font-medium text-[#646cff] no-underline hover:text-[#535bf2] light:hover:text-[#747bff]"
                        href={`${project.slug}/`}
                    >
                        {project.title}
                    </a>
                </div>
            ))}
        </>
    )
}
