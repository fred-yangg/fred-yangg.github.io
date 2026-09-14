import type {GradientCurve} from './types.ts'

export const THEME_STORAGE_KEY = 'fractal-clock-theme'
export const GRADIENT_STORAGE_KEY = 'fractal-clock-gradient'
export const DEFAULT_FRACTAL_COLOR_START = '#2fd0e9'
export const DEFAULT_FRACTAL_COLOR_END = '#9a39a7'
export const DEFAULT_GRADIENT_CURVE: GradientCurve = 'proportional'
export const DEFAULT_HOUR_BIAS = 0.9
export const DEFAULT_MINUTE_BIAS = 1.07

export const MAX_MINUTE_RPS = 3
export const REALTIME_MINUTE_RPS = 1 / 3600

export const SCALE = 1 / Math.SQRT2
export const MIN_LENGTH_PX = 0.5
export const ROOT_HOUR_WIDTH_PX = 6
export const ROOT_HOUR_THICK_FRACTION = 0.65
export const ROOT_MINUTE_WIDTH_PX = 4
export const CHILD_STROKE_WIDTH_PX = 1
export const VIEW_MARGIN_PX = 8
export const MAX_INSTANCES = 1 << 20
export const INSTANCE_FLOATS = 8
export const QUEUE_FLOATS = 6

export function clampBias(value: number, fallback: number) {
    if (!Number.isFinite(value)) return fallback
    return Math.max(0, Math.min(2, Number(value.toFixed(2))))
}
