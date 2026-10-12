import {hardDrop, hold, rotate, shift, sonicDrop, softStep, type Game, type Lock} from './engine.ts'

export type Handling = {
    das: number
    arr: number
    dcd: number
    sdf: number | null
    cancelDas: boolean
}

export type Input = {
    left: boolean
    right: boolean
    soft: boolean
    leftAt: number
    rightAt: number
    dir: -1 | 0 | 1
    dasMs: number
    charged: boolean
    arrMs: number
    cutMs: number
    softMs: number
    now: number
    generation: number
}

export function createInput(generation: number): Input {
    return {
        left: false,
        right: false,
        soft: false,
        leftAt: 0,
        rightAt: 0,
        dir: 0,
        dasMs: 0,
        charged: false,
        arrMs: 0,
        cutMs: 0,
        softMs: 0,
        now: 0,
        generation,
    }
}

function liveDir(input: Input): -1 | 0 | 1 {
    if (input.left && input.right) return input.leftAt >= input.rightAt ? -1 : 1
    if (input.left) return -1
    if (input.right) return 1
    return 0
}

function adoptDir(input: Input, handling: Handling) {
    const next = liveDir(input)
    if (next === input.dir) return
    if (next === 0) {
        input.dir = 0
        input.charged = false
        input.dasMs = 0
        input.arrMs = 0
        return
    }
    if (handling.cancelDas || !input.charged) {
        input.charged = false
        input.dasMs = 0
    }
    input.arrMs = 0
    input.dir = next
}

function slide(game: Game, dir: -1 | 1) {
    while (shift(game, dir)) { /* keep going */ }
}

// move is false while the board is paused. The key still counts as held,
// so DAS is ready when play resumes.
export function pressHorizontal(input: Input, dir: -1 | 1, game: Game, handling: Handling, move = true) {
    if (dir < 0) {
        input.left = true
        input.leftAt = input.now
    } else {
        input.right = true
        input.rightAt = input.now
    }
    adoptDir(input, handling)
    if (move) shift(game, dir)
}

export function releaseHorizontal(input: Input, dir: -1 | 1, handling: Handling) {
    if (dir < 0) input.left = false
    else input.right = false
    adoptDir(input, handling)
}

export function pressSoft(input: Input, game: Game, handling: Handling, move = true) {
    input.soft = true
    if (move && handling.sdf == null) sonicDrop(game)
}

export function releaseSoft(input: Input) {
    input.soft = false
    input.softMs = 0
}

function noteSpawn(input: Input, game: Game, handling: Handling) {
    if (game.generation === input.generation) return
    input.generation = game.generation
    input.cutMs = handling.dcd
}

export function pressRotate(input: Input, game: Game, handling: Handling, dir: 1 | -1 | 2) {
    if (rotate(game, dir)) input.cutMs = handling.dcd
}

export function pressHard(input: Input, game: Game, handling: Handling): Lock | null {
    const lock = hardDrop(game)
    noteSpawn(input, game, handling)
    return lock
}

export function pressHold(input: Input, game: Game, handling: Handling) {
    if (hold(game)) noteSpawn(input, game, handling)
}

export function tickInput(input: Input, game: Game, handling: Handling, dt: number) {
    input.now += dt
    const dir = liveDir(input)
    if (dir === 0) {
        input.dir = 0
        input.charged = false
        input.dasMs = 0
        input.arrMs = 0
    } else if (game.active && !game.frozen) {
        if (dir !== input.dir) adoptDir(input, handling)
        if (input.cutMs > 0) {
            input.cutMs = Math.max(0, input.cutMs - dt)
        } else if (!input.charged) {
            input.dasMs += dt
            if (input.dasMs >= handling.das) {
                input.charged = true
                input.arrMs = 0
                if (handling.arr === 0) slide(game, dir)
                else shift(game, dir)
            }
        } else if (handling.arr === 0) {
            slide(game, dir)
        } else {
            input.arrMs += dt
            while (input.arrMs >= handling.arr) {
                input.arrMs -= handling.arr
                if (!shift(game, dir)) break
            }
        }
    }

    if (input.soft && game.active && !game.frozen) {
        if (handling.sdf == null) sonicDrop(game)
        else {
            // 0.02G is TETR.IO's base gravity. SDF multiplies it even though nothing falls here.
            const rowsPerMs = (0.02 * 60 * handling.sdf) / 1000
            input.softMs += dt * rowsPerMs
            while (input.softMs >= 1) {
                input.softMs -= 1
                if (!softStep(game)) break
            }
        }
    } else {
        input.softMs = 0
    }

    noteSpawn(input, game, handling)
}
