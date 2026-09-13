import {createRoot} from 'react-dom/client'

import {App} from './app.tsx'
import './main.css'

createRoot(document.getElementById('app')!).render(<App/>)
