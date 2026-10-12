import {createRoot} from 'react-dom/client'

import {App} from './app.tsx'
import '../styles.css'
import './tetris.css'

createRoot(document.getElementById('app')!).render(<App/>)
