import type {DiscreteHourStep, GradientCurve} from './types.ts'

export const THEME_STORAGE_KEY = 'fractal-clock-theme'
export const GRADIENT_STORAGE_KEY = 'fractal-clock-gradient'
export const DISCRETE_HOUR_STORAGE_KEY = 'fractal-clock-discrete-hour'
export const DISCRETE_HOUR_STEP_STORAGE_KEY = 'fractal-clock-discrete-hour-step'
export const DEFAULT_DISCRETE_HOUR_STEP: DiscreteHourStep = 60
export const DISCRETE_HOUR_STEPS = [15, 20, 30, 60] as const
export const DEFAULT_FRACTAL_COLOR_START = '#2fd0e9'
export const DEFAULT_FRACTAL_COLOR_END = '#9a39a7'
export const DEFAULT_GRADIENT_CURVE: GradientCurve = 'biased'
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
export const QUEUE_FLOATS = 7

export const INTRO_HOLD_SEC = 0.35
export const INTRO_SPAWN_SEC = 0.22
export const INTRO_SETTLE_SEC = 0.2
export const INTRO_SWEEP_SEC = 3.2

export function clampBias(value: number, fallback: number) {
    if (!Number.isFinite(value)) return fallback
    return Math.max(0, Math.min(2, Number(value.toFixed(2))))
}
