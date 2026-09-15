export type ClockTheme = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'
export type GradientCurve = 'linear' | 'proportional' | 'biased'

export type ClockSettings = {
    syncToNow: boolean
    /** Hours into a 12-hour cycle. */
    hour: number
    /** Minute-hand revolutions per second. Clamped to ±MAX_MINUTE_RPS. */
    hoursPerSecond: number
    theme: ClockTheme
    fractalColorStart: string
    fractalColorEnd: string
    gradientCurve: GradientCurve
    hourBias: number
    minuteBias: number
}

export type Hand = {
    enabled: boolean
    angle: number
    rootWidth: number
    /** Fraction of root length that is thick. The rest is a 1px tail to the fractal. */
    rootThickFraction: number
    isHour: boolean
}

export type StoredGradient = {
    start: string
    end: string
    curve: GradientCurve
    hourBias: number
    minuteBias: number
}
