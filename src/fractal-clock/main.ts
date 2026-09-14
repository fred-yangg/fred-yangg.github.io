import '../styles.css'
import './settings.css'
import {hourFromDate, startClock, type ClockSettings} from './fractalClock.ts'
import {mountSettings} from './settings.ts'

const root = document.getElementById('clock-root')
if (!root) {
    throw new Error('Missing #clock-root')
}

const settings: ClockSettings = {
    syncToNow: true,
    hour: hourFromDate(),
    hoursPerSecond: 0,
}

startClock(root, settings)
mountSettings(settings)
