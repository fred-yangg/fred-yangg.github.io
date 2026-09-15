import {
    INTRO_HOLD_SEC,
    INTRO_SPAWN_SEC,
    INTRO_START_HOUR,
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
    spawn: IntroSpawn | undefined
    skip: () => void
    update: (dt: number, maxDepth: number) => void
}

function easeInOutCubic(t: number) {
    const x = Math.min(1, Math.max(0, t))
    return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2
}

function easeOutCubic(t: number) {
    const x = Math.min(1, Math.max(0, t))
    return 1 - (1 - x) ** 3
}

function sweepEnd(startHour: number, nowHour: number) {
    const forward = wrapHour(nowHour - startHour)
    return startHour + 12 + forward
}

export function createIntro(): ClockIntro {
    let phase: 'hold' | 'spawn' | 'sweep' | 'done' = 'hold'
    let elapsed = 0
    let depth = 0
    let spawnT = 0
    let hour = INTRO_START_HOUR
    let fromHour = INTRO_START_HOUR
    let toHour = INTRO_START_HOUR
    let done = false

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
        get spawn(): IntroSpawn | undefined {
            if (done || phase === 'sweep') return undefined
            return {depth, t: easeOutCubic(spawnT)}
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
                spawnT += dt / INTRO_SPAWN_SEC
                while (spawnT >= 1) {
                    spawnT -= 1
                    if (depth >= levels) {
                        phase = 'sweep'
                        elapsed = 0
                        fromHour = INTRO_START_HOUR
                        toHour = sweepEnd(fromHour, hourFromDate())
                        hour = fromHour
                        spawnT = 1
                        break
                    }
                    depth += 1
                }
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
