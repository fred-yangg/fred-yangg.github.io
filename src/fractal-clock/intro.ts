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
    return easeInCubic(0.9 * (1 - depth / levels))
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

function mirroredHandsHour(clockHour: number) {
    return 12 * (clockHour + 1) / 13
}

function hourDistance(a: number, b: number) {
    const d = wrapHour(a - b)
    return Math.min(d, 12 - d)
}

function introStartHour(now: number) {
    const aroundEleven = mirroredHandsHour(11)
    const aroundTen = mirroredHandsHour(10)
    return hourDistance(now, aroundEleven) < 1 ? aroundTen : aroundEleven
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
