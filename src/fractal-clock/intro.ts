import {
    INTRO_HOLD_SEC,
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

function introStartHour(now: number) {
    let hour = wrapHour(Math.floor(now) - 1)
    if (hour === 0 || hour === 6) hour = wrapHour(hour - 1)
    return hour + 10 / 60
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
                const eased = easeInCubic(elapsed / total)
                if (eased >= 1) {
                    beginSweep()
                    return
                }
                const pos = eased * levels
                depth = Math.min(levels, Math.floor(pos) + 1)
                spawnT = pos - Math.floor(pos)
                return
            }

            if (phase === 'sweep') {
                elapsed += dt
                const t = easeInOutCubic(elapsed / INTRO_SWEEP_SEC)
                hour = fromHour + (toHour - fromHour) * t
                if (elapsed >= INTRO_SWEEP_SEC) finish(true)
            }
        },
    }
}
