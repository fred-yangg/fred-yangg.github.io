import {startClock} from './clock.ts'
import {mustGetById} from './dom.ts'
import {mountSettings} from './settings.ts'
import {createClockSettings} from './storage.ts'
import {applyClockTheme} from './theme.ts'

const root = mustGetById('clock-root')
const settings = createClockSettings()
applyClockTheme(settings.theme)
startClock(root, settings)
mountSettings(settings)
