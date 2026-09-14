import '../styles.css'
import './settings.css'
import {
    applyClockTheme,
    hourFromDate,
    loadClockTheme,
    loadFractalGradient,
    startClock,
    type ClockSettings,
} from './fractalClock.ts'
import {mountSettings} from './settings.ts'

const root = document.getElementById('clock-root')
if (!root) {
    throw new Error('Missing #clock-root')
}

const gradient = loadFractalGradient()
const settings: ClockSettings = {
    syncToNow: true,
    hour: hourFromDate(),
    hoursPerSecond: 0,
    theme: loadClockTheme(),
    fractalColorStart: gradient.start,
    fractalColorEnd: gradient.end,
    gradientForTheme: gradient.forTheme,
    gradientCurve: gradient.curve,
    hourBias: gradient.hourBias,
    minuteBias: gradient.minuteBias,
}

applyClockTheme(settings.theme)
startClock(root, settings)
mountSettings(settings)
