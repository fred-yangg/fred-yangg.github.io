import '../styles.css'
import {startClock} from './fractalClock.ts'

const root = document.getElementById('clock-root')
if (!root) {
    throw new Error('Missing #clock-root')
}

startClock(root)
