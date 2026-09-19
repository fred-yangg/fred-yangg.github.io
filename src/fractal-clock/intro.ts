import {
    INTRO_HOLD_SEC,
    INTRO_SETTLE_SEC,
    INTRO_SPAWN_SEC,
    INTRO_SWEEP_SEC,
} from './constants.ts'
import {hourFromDate, wrapHour} from './time.ts'

export type IntroSpawn = {
    depth: number
    t: number
}

export type ClockIntro = {
    done: boolean
    hour: number
    startHour: number
    spawn: IntroSpawn | undefined
    skip: () => void
    update: (dt: number, maxDepth: number) => void
}

function easeInOutCubic(t: number) {
    const x = Math.min(1, Math.max(0, t))
    return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2
}

function easeInCubic(t: number) {
    const x = Math.min(1, Math.max(0, t))
    return x * x * x
}

function spawnWeight(depth: number, levels: number) {
    return easeInCubic(1 - depth / levels) + 1 / levels
}

function spawnAt(elapsed: number, total: number, levels: number) {
    if (elapsed <= 0) return {depth: 1, t: 0, done: false}
    if (elapsed >= total) return {depth: levels, t: 1, done: true}
    let weightSum = 0
    for (let i = 1; i <= levels; i++) weightSum += spawnWeight(i, levels)
    let acc = 0
    for (let depth = 1; depth <= levels; depth++) {
        const duration = weightSum > 0 ? total * spawnWeight(depth, levels) / weightSum : 0
        if (elapsed < acc + duration || depth === levels) {
            const u = duration > 0 ? Math.min(1, Math.max(0, (elapsed - acc) / duration)) : 1
            return {depth, t: easeInCubic(u), done: false}
        }
        acc += duration
    }
    return {depth: levels, t: 1, done: true}
}

const MIN_START_BEHIND_HOURS = 1
const MAX_START_BEHIND_HOURS = 2
const MIN_HAND_SEPARATION_DEG = 30
const MAX_HAND_SEPARATION_DEG = 70
const START_HOUR_SAMPLES = 3600

function handSeparationDegrees(hour: number) {
    const wrapped = wrapHour(hour)
    const hourDeg = wrapped * 30
    const minuteDeg = (wrapped % 1) * 360
    const delta = Math.abs(hourDeg - minuteDeg) % 360
    return Math.min(delta, 360 - delta)
}

function introStartHour(now: number) {
    const span = MAX_START_BEHIND_HOURS - MIN_START_BEHIND_HOURS
    const valid: number[] = []
    for (let i = 0; i < START_HOUR_SAMPLES; i++) {
        const hour = now - MIN_START_BEHIND_HOURS - (i / START_HOUR_SAMPLES) * span
        const separation = handSeparationDegrees(hour)
        if (separation >= MIN_HAND_SEPARATION_DEG && separation <= MAX_HAND_SEPARATION_DEG) {
            valid.push(hour)
        }
    }
    if (valid.length === 0) return now - MIN_START_BEHIND_HOURS
    return valid[Math.floor(Math.random() * valid.length)]
}

function sweepEnd(startHour: number, nowHour: number) {
    return startHour + wrapHour(nowHour - startHour)
}

export function createIntro(): ClockIntro {
    const startHour = introStartHour(hourFromDate())
    let phase: 'hold' | 'spawn' | 'sweep' | 'done' = 'hold'
    let elapsed = 0
    let depth = 0
    let spawnT = 0
    let hour = startHour
    let fromHour = startHour
    let toHour = startHour
    let done = false

    const beginSweep = () => {
        phase = 'sweep'
        elapsed = 0
        fromHour = startHour
        toHour = sweepEnd(fromHour, hourFromDate())
        hour = fromHour
        depth = 0
        spawnT = 1
    }

    const finish = (snapToNow: boolean) => {
        phase = 'done'
        done = true
        if (snapToNow) hour = hourFromDate()
    }

    return {
        get done() {
            return done
        },
        get hour() {
            return hour
        },
        get startHour() {
            return startHour
        },
        get spawn(): IntroSpawn | undefined {
            if (done || phase === 'sweep') return undefined
            return {depth, t: spawnT}
        },
        skip() {
            finish(false)
        },
        update(dt, maxDepth) {
            if (done) return
            const levels = Math.max(1, maxDepth)

            if (phase === 'hold') {
                elapsed += dt
                if (elapsed < INTRO_HOLD_SEC) return
                phase = 'spawn'
                depth = 1
                spawnT = 0
                elapsed = 0
            }

            if (phase === 'spawn') {
                elapsed += dt
                const total = INTRO_SPAWN_SEC * levels
                const at = spawnAt(elapsed, total, levels)
                depth = at.depth
                spawnT = at.t
                if (at.done && elapsed >= total + INTRO_SETTLE_SEC) beginSweep()
                return
            }

            if (phase === 'sweep') {
                elapsed += dt
                toHour = sweepEnd(fromHour, hourFromDate())
                const t = easeInOutCubic(elapsed / INTRO_SWEEP_SEC)
                hour = fromHour + (toHour - fromHour) * t
                if (elapsed >= INTRO_SWEEP_SEC) finish(true)
            }
        },
    }
}
