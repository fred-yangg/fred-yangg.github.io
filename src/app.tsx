import {useState} from 'preact/hooks'

import './app.css'

export function App() {
    const [count, setCount] = useState(0)

    return (
        <>
            <h1>Fred Yang</h1>
            <h3>Hello, World!</h3>
            <div class="card">
                <button onClick={() => setCount((count) => count + 1)}>
                    count is {count}
                </button>
            </div>

            <a href="fractal-clock/">Fractal Clock</a>
        </>
    )
}
