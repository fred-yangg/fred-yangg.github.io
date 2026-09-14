import '../styles.css'
import './settings.css'
import {applyClockTheme, hourFromDate, loadClockTheme, startClock, type ClockSettings} from './fractalClock.ts'
import {mountSettings} from './settings.ts'

const root = document.getElementById('clock-root')
if (!root) {
    throw new Error('Missing #clock-root')
}

const settings: ClockSettings = {
    syncToNow: true,
    hour: hourFromDate(),
    hoursPerSecond: 0,
    theme: loadClockTheme(),
}

applyClockTheme(settings.theme)
startClock(root, settings)
mountSettings(settings)
