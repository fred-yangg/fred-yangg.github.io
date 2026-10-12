import {kickTests, type KickTable} from './kicks.ts'
import {cells, type Piece, type Rot} from './pieces.ts'
import {classifySpin, HEIGHT, SPAWN_X, SPAWN_Y, WIDTH, type Spin} from './rules.ts'

export {HEIGHT, SPAWN_X, SPAWN_Y, WIDTH}
export type {KickTable, Piece, Rot, Spin}

// Cell ids: 1 I, 2 J, 3 L, 4 O, 5 S, 6 T, 7 Z, 8 garbage.
export const CELL: Record<Piece, number> = {I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7}
export const GARBAGE = 8

export type Active = {
    piece: Piece
    rot: Rot
    x: number
    y: number
    lastRotation: boolean
    kickIndex: number
    quarter: boolean
}

export type Lock = {
    piece: Piece
    rot: Rot
    x: number
    y: number
    spin: Spin
    lines: number
    // Rows that cleared, numbered before the clear.
    cleared: number[]
    perfect: boolean
}

// The state at the start of a turn, before any hold.
type Turn = {
    board: Uint8Array
    active: Piece | null
    queue: Piece[]
    hold: Piece | null
}

// Pieces never fall or lock on their own. A piece locks only on hard drop.
export type Game = {
    board: Uint8Array
    queue: Piece[]
    hold: Piece | null
    holdLocked: boolean
    active: Active | null
    kick: KickTable
    frozen: boolean
    generation: number
    turns: Turn[]
}

export type Setup = {
    board: Uint8Array
    queue: Piece[]
    hold: Piece | null
}

export function fits(board: Uint8Array, piece: Piece, rot: Rot, x: number, y: number): boolean {
    for (const [dx, dy] of cells(piece, rot)) {
        const cx = x + dx
        const cy = y + dy
        if (cx < 0 || cx >= WIDTH || cy >= HEIGHT) return false
        if (cy >= 0 && board[cy * WIDTH + cx] !== 0) return false
    }
    return true
}

function spawnPiece(game: Game, piece: Piece | null) {
    game.holdLocked = false
    game.generation++
    game.active = piece && {piece, rot: 0, x: SPAWN_X, y: SPAWN_Y, lastRotation: false, kickIndex: -1, quarter: false}
}

function startTurn(game: Game, turn: Turn) {
    game.board = turn.board.slice()
    game.queue = turn.queue.slice()
    game.hold = turn.hold
    spawnPiece(game, turn.active)
}

export function createGame(setup: Setup, kick: KickTable): Game {
    const queue = setup.queue.slice()
    const first: Turn = {board: setup.board.slice(), active: queue.shift() ?? null, queue, hold: setup.hold}
    const game: Game = {
        board: first.board,
        queue: [],
        hold: null,
        holdLocked: false,
        active: null,
        kick,
        frozen: false,
        generation: 0,
        turns: [first],
    }
    startTurn(game, first)
    return game
}

function live(game: Game): Active | null {
    return game.frozen ? null : game.active
}

export function shift(game: Game, dx: number): boolean {
    const a = live(game)
    if (!a || !fits(game.board, a.piece, a.rot, a.x + dx, a.y)) return false
    a.x += dx
    a.lastRotation = false
    return true
}

export function softStep(game: Game): boolean {
    const a = live(game)
    if (!a || !fits(game.board, a.piece, a.rot, a.x, a.y + 1)) return false
    a.y += 1
    a.lastRotation = false
    return true
}

export function sonicDrop(game: Game): boolean {
    const a = live(game)
    if (!a) return false
    const floor = ghostY(game)!
    if (floor === a.y) return false
    a.y = floor
    a.lastRotation = false
    return true
}

export function rotate(game: Game, dir: 1 | -1 | 2): boolean {
    const a = live(game)
    if (!a) return false
    const to = ((a.rot + dir + 4) % 4) as Rot
    const tests = kickTests(game.kick, a.piece, a.rot, to)
    for (let i = 0; i < tests.length; i++) {
        const nx = a.x + tests[i][0]
        const ny = a.y - tests[i][1]
        if (!fits(game.board, a.piece, to, nx, ny)) continue
        a.x = nx
        a.y = ny
        a.rot = to
        a.lastRotation = true
        a.kickIndex = i
        a.quarter = tests.length === 5
        return true
    }
    return false
}

function filledAt(board: Uint8Array, x: number, y: number): boolean {
    if (x < 0 || x >= WIDTH || y >= HEIGHT) return true
    if (y < 0) return false
    return board[y * WIDTH + x] !== 0
}

function clearLines(board: Uint8Array): {board: Uint8Array; cleared: number[]} {
    const keep: number[] = []
    const cleared: number[] = []
    for (let y = 0; y < HEIGHT; y++) {
        if (board.subarray(y * WIDTH, y * WIDTH + WIDTH).includes(0)) keep.push(y)
        else cleared.push(y)
    }
    const next = new Uint8Array(WIDTH * HEIGHT)
    keep.forEach((y, i) => next.set(board.subarray(y * WIDTH, y * WIDTH + WIDTH), (cleared.length + i) * WIDTH))
    return {board: next, cleared}
}

export function hardDrop(game: Game): Lock | null {
    const a = live(game)
    if (!a) return null
    const floor = ghostY(game)!
    if (floor !== a.y) a.lastRotation = false
    a.y = floor
    const spin = a.piece === 'T' && a.lastRotation
        ? classifySpin((x, y) => filledAt(game.board, x, y), a.rot, a.x, a.y, a.kickIndex, a.quarter)
        : 'none'
    const stamped = game.board.slice()
    for (const [dx, dy] of cells(a.piece, a.rot)) {
        const y = a.y + dy
        if (y >= 0) stamped[y * WIDTH + a.x + dx] = CELL[a.piece]
    }
    const {board, cleared} = clearLines(stamped)
    const lock: Lock = {
        piece: a.piece,
        rot: a.rot,
        x: a.x,
        y: a.y,
        spin,
        lines: cleared.length,
        cleared,
        perfect: cleared.length > 0 && board.every(cell => cell === 0),
    }
    const queue = game.queue.slice()
    let hold = game.hold
    let next = queue.shift() ?? null
    if (!next && hold) {
        next = hold
        hold = null
    }
    const turn: Turn = {board, active: next, queue, hold}
    game.turns.push(turn)
    startTurn(game, turn)
    return lock
}

export function hold(game: Game): boolean {
    const a = live(game)
    if (!a || game.holdLocked) return false
    if (game.hold) {
        const swapped = game.hold
        game.hold = a.piece
        spawnPiece(game, swapped)
    } else {
        if (!game.queue.length) return false
        game.hold = a.piece
        spawnPiece(game, game.queue.shift()!)
    }
    game.holdLocked = true
    return true
}

// Back to the start of the previous turn.
export function undo(game: Game): boolean {
    if (game.turns.length < 2) return false
    game.turns.pop()
    game.frozen = false
    startTurn(game, game.turns[game.turns.length - 1])
    return true
}

// Back to the start of this turn, undoing a hold.
export function resetTurn(game: Game) {
    game.frozen = false
    startTurn(game, game.turns[game.turns.length - 1])
}

export function restart(game: Game) {
    game.turns.length = 1
    game.frozen = false
    startTurn(game, game.turns[0])
}

export function ghostY(game: Game): number | null {
    const a = game.active
    if (!a) return null
    let y = a.y
    while (fits(game.board, a.piece, a.rot, a.x, y + 1)) y++
    return y
}

export function placedCount(game: Game): number {
    return game.turns.length - 1
}
