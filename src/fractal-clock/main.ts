import '../styles.css'
import './settings.css'
import {startClock, type ClockSettings} from './fractalClock.ts'
import {mountSettings} from './settings.ts'

const root = document.getElementById('clock-root')
if (!root) {
    throw new Error('Missing #clock-root')
}

const settings: ClockSettings = {
    hourHand: false,
}

startClock(root, settings)
mountSettings(settings)
