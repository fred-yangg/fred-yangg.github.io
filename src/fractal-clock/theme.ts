import {parseCssColor} from './color.ts'
import type {ClockTheme, ResolvedTheme} from './types.ts'

export function effectiveClockTheme(theme: ClockTheme): ResolvedTheme {
    if (theme !== 'system') return theme
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function applyClockTheme(theme: ClockTheme) {
    document.documentElement.dataset.clockTheme = theme
}

export function readThemeColors() {
    const styles = getComputedStyle(document.documentElement)
    const paper = styles.getPropertyValue('--clock-paper').trim() || '#f3f2ee'
    const ink = styles.getPropertyValue('--clock-ink').trim() || '#111111'
    return {ink, paper, inkRgb: parseCssColor(ink)}
}
