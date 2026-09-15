import {
    clampBias,
    DEFAULT_FRACTAL_COLOR_END,
    DEFAULT_FRACTAL_COLOR_START,
    DEFAULT_GRADIENT_CURVE,
    DEFAULT_HOUR_BIAS,
    DEFAULT_MINUTE_BIAS,
    GRADIENT_STORAGE_KEY,
    THEME_STORAGE_KEY,
} from './constants.ts'
import {parseHexColor} from './color.ts'
import {hourFromDate} from './time.ts'
import type {ClockSettings, ClockTheme, GradientCurve, StoredGradient} from './types.ts'

function readStorage(key: string) {
    try {
        return localStorage.getItem(key)
    } catch {
        return null
    }
}

function writeStorage(key: string, value: string) {
    try {
        localStorage.setItem(key, value)
    } catch {
        // ignore
    }
}

export function loadClockTheme(): ClockTheme {
    const stored = readStorage(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
    return 'system'
}

export function saveClockTheme(theme: ClockTheme) {
    writeStorage(THEME_STORAGE_KEY, theme)
}

export function loadFractalGradient(): StoredGradient {
    const raw = readStorage(GRADIENT_STORAGE_KEY)
    if (raw) {
        try {
            const parsed = JSON.parse(raw) as {
                start?: string
                end?: string
                curve?: string
                hourBias?: number
                minuteBias?: number
            }
            const start = parseHexColor(parsed.start ?? '') ? parsed.start! : DEFAULT_FRACTAL_COLOR_START
            const end = parseHexColor(parsed.end ?? '') ? parsed.end! : DEFAULT_FRACTAL_COLOR_END
            const curve: GradientCurve =
                parsed.curve === 'linear' || parsed.curve === 'proportional' || parsed.curve === 'biased'
                    ? parsed.curve
                    : DEFAULT_GRADIENT_CURVE
            return {
                start,
                end,
                curve,
                hourBias: clampBias(Number(parsed.hourBias), DEFAULT_HOUR_BIAS),
                minuteBias: clampBias(Number(parsed.minuteBias), DEFAULT_MINUTE_BIAS),
            }
        } catch {
            // ignore
        }
    }
    return {
        start: DEFAULT_FRACTAL_COLOR_START,
        end: DEFAULT_FRACTAL_COLOR_END,
        curve: DEFAULT_GRADIENT_CURVE,
        hourBias: DEFAULT_HOUR_BIAS,
        minuteBias: DEFAULT_MINUTE_BIAS,
    }
}

export function saveFractalGradient(settings: ClockSettings) {
    settings.hourBias = clampBias(settings.hourBias, DEFAULT_HOUR_BIAS)
    settings.minuteBias = clampBias(settings.minuteBias, DEFAULT_MINUTE_BIAS)
    writeStorage(
        GRADIENT_STORAGE_KEY,
        JSON.stringify({
            start: settings.fractalColorStart,
            end: settings.fractalColorEnd,
            curve: settings.gradientCurve,
            hourBias: settings.hourBias,
            minuteBias: settings.minuteBias,
        }),
    )
}

export function createClockSettings(): ClockSettings {
    const gradient = loadFractalGradient()
    return {
        syncToNow: true,
        hour: hourFromDate(),
        hoursPerSecond: 0,
        theme: loadClockTheme(),
        fractalColorStart: gradient.start,
        fractalColorEnd: gradient.end,
        gradientCurve: gradient.curve,
        hourBias: gradient.hourBias,
        minuteBias: gradient.minuteBias,
    }
}
