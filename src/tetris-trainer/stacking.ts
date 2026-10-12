// Shared pieces of the puzzle generators: seeded randomness, colored fields,
// and building target boards out of real pieces.

import {PIECES, SHAPES, type Piece, type Rot} from './pieces.ts'
import {boardOf} from './puzzles.ts'
import {HEIGHT, WIDTH} from './rules.ts'
import {createSolver, fitsRows, lock, OutOfBudget, placements, rowsOf, type Goal, type Options, type Placement, type Rows, type Turn} from './solver.ts'

export const TUCK: Options = {kick: 'SRS+', moves: 'tuck'}
export const LINES = {tss: 1, tsd: 2, tst: 3} as const
export type Spin = keyof typeof LINES
export const FULL = (1 << WIDTH) - 1

export function mulberry(seed: number) {
    return () => {
        seed = seed + 0x6d2b79f5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

export type Random = () => number

export function shuffle<T>(random: Random, list: T[]): T[] {
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]]
    }
    return list
}

export const bag = (random: Random): Piece[] => shuffle(random, [...PIECES])

export function bags(random: Random, count: number): Piece[] {
    const out: Piece[] = []
    for (let i = 0; i < count; i++) out.push(...bag(random))
    return out
}

export function pick<T>(random: Random, list: T[]): T {
    return list[Math.floor(random() * list.length)]
}

export function popcount(n: number): number {
    let count = 0
    for (; n; n &= n - 1) count++
    return count
}

export function lowestBit(n: number): number {
    return 31 - Math.clz32(n & -n)
}

// Pieces and garbage with their colors, tracked through line clears.
export type Field = {rows: Rows; colors: Map<number, string>}

export const emptyField = (): Field => ({rows: new Uint16Array(HEIGHT), colors: new Map()})

export function fieldOf(text: string): Field {
    const board = boardOf(text)
    const field = emptyField()
    field.rows = rowsOf(board)
    const lines = text ? text.split('/') : []
    lines.forEach((line, r) => {
        const y = HEIGHT - lines.length + r
        for (let x = 0; x < WIDTH; x++) if (/[IJLOSTZ]/.test(line[x])) field.colors.set(y * WIDTH + x, line[x])
    })
    return field
}

export function encode(field: Field): string {
    const out: string[] = []
    for (let y = 0; y < HEIGHT; y++) {
        if (!field.rows[y] && !out.length) continue
        let row = ''
        for (let x = 0; x < WIDTH; x++) row += field.rows[y] >> x & 1 ? field.colors.get(y * WIDTH + x) ?? 'G' : '.'
        out.push(row)
    }
    return out.join('/')
}

export type Drop = {piece: Piece; rot: Rot; x: number; y: number}

export function place(field: Field, drop: Drop): {field: Field; lines: number} {
    const stamped = new Map(field.colors)
    for (const [dx, dy] of SHAPES[drop.piece][drop.rot]) stamped.set((drop.y + dy) * WIDTH + drop.x + dx, drop.piece)
    const locked = lock(field.rows, drop.piece, drop.rot, drop.x, drop.y)
    if (!locked.lines) return {field: {rows: locked.rows, colors: stamped}, lines: 0}
    const before = field.rows.slice()
    for (const [dx, dy] of SHAPES[drop.piece][drop.rot]) before[drop.y + dy] |= 1 << drop.x + dx
    const full: number[] = []
    for (let y = 0; y < HEIGHT; y++) if (before[y] === FULL) full.push(y)
    const colors = new Map<number, string>()
    for (const [cell, color] of stamped) {
        const y = Math.floor(cell / WIDTH)
        if (!full.includes(y)) colors.set(cell + full.filter(row => row > y).length * WIDTH, color)
    }
    return {field: {rows: locked.rows, colors}, lines: locked.lines}
}

export const SWAP: Record<string, string> = {J: 'L', L: 'J', S: 'Z', Z: 'S'}

export function mirror(text: string): string {
    return text.split('/').map(row => [...row].reverse().map(ch => SWAP[ch] ?? ch).join('')).join('/')
}

// How many of each piece a board's colored cells make.
export function piecesIn(text: string): Piece[] {
    const out: Piece[] = []
    for (const piece of PIECES) {
        const cells = text.split(piece).length - 1
        for (let i = 0; i < cells / 4; i++) out.push(piece)
    }
    return out
}

export function turnFrom(rows: Rows, queue: Piece[], hold: Piece | null): Turn {
    return {rows, active: queue[0], queue: queue.slice(1), hold, canHold: true, stage: 0}
}

// Solvable with both kick tables, so the player's choice doesn't matter.
// Candidates that take too long to decide are dropped.
export function solvable(goal: Goal, turn: Turn): boolean {
    try {
        return createSolver(goal, {...TUCK, budget: 300_000}).solvable(turn) && createSolver(goal, {...TUCK, kick: 'SRS', budget: 300_000}).solvable(turn)
    } catch (error) {
        if (error instanceof OutOfBudget) return false
        throw error
    }
}

// Placements a piece reaches by rotating and shifting at the top, then dropping.
export function drops(rows: Rows, piece: Piece): Drop[] {
    const out: Drop[] = []
    const seen = new Set<string>()
    for (let rot = 0 as Rot; rot < 4; rot++) {
        for (let x = -2; x < WIDTH; x++) {
            if (!fitsRows(rows, piece, rot, x, 0)) continue
            let y = 0
            while (fitsRows(rows, piece, rot, x, y + 1)) y++
            const key = SHAPES[piece][rot].map(([dx, dy]) => (y + dy) * WIDTH + x + dx).sort().join()
            if (seen.has(key)) continue
            seen.add(key)
            out.push({piece, rot: rot as Rot, x, y})
        }
    }
    return out
}

export function heights(rows: Rows): number[] {
    const h = new Array(WIDTH).fill(0)
    for (let x = 0; x < WIDTH; x++) {
        for (let y = 0; y < HEIGHT; y++) {
            if (rows[y] >> x & 1) {
                h[x] = HEIGHT - y
                break
            }
        }
    }
    return h
}

export function holes(rows: Rows): number {
    let count = 0
    for (let x = 0; x < WIDTH; x++) {
        let roof = false
        for (let y = 0; y < HEIGHT; y++) {
            const on = (rows[y] >> x & 1) === 1
            if (on) roof = true
            else if (roof) count++
        }
    }
    return count
}

// Empty cells whose nearest filled cell above was placed: the holes a
// solution made. Cells the field started with have no color. Holes in the
// columns passed don't count.
export function faults(field: Field, skip: number[] = []): number {
    let count = 0
    for (let x = 0; x < WIDTH; x++) {
        if (skip.includes(x)) continue
        let placed = false
        for (let y = 0; y < HEIGHT; y++) {
            if (field.rows[y] >> x & 1) placed = field.colors.has(y * WIDTH + x)
            else if (placed) count++
        }
    }
    return count
}

export function stackHeight(rows: Rows): number {
    const top = rows.findIndex(row => row !== 0)
    return top < 0 ? 0 : HEIGHT - top
}

// Remaining target areas must each hold whole pieces.
export function tileable(target: Rows, rows: Rows): boolean {
    const left = Array.from(target, (row, y) => row & ~rows[y])
    for (let y = HEIGHT - 1; y >= 0; y--) {
        while (left[y]) {
            let size = 0
            const stack = [[lowestBit(left[y]), y]]
            left[y] &= ~(1 << stack[0][0])
            while (stack.length) {
                const [x, cy] = stack.pop()!
                size++
                for (const [nx, ny] of [[x - 1, cy], [x + 1, cy], [x, cy - 1], [x, cy + 1]]) {
                    if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT || !(left[ny] >> nx & 1)) continue
                    left[ny] &= ~(1 << nx)
                    stack.push([nx, ny])
                }
            }
            if (size % 4) return false
        }
    }
    return true
}

export type History = {field: Field; piece: Piece}[]

// Builds a target out of real pieces, bottom up. Colored cells have to be
// covered by a piece of that color lying exactly on them, which recovers a
// diagram's own pieces. Other cells take any of `pieces`.
// Returns the field before each placement, then the finished field.
export function build(random: Random, base: Field, target: Rows, colors?: Map<number, string>, pieces: readonly Piece[] = PIECES): History | null {
    let budget = 3000
    const visit = (field: Field, history: History): History | null => {
        if (budget-- <= 0) return null
        let ey = -1
        for (let y = HEIGHT - 1; y >= 0 && ey < 0; y--) if (target[y] & ~field.rows[y]) ey = y
        if (ey < 0) return [...history, {field, piece: 'T'}]
        const ex = lowestBit(target[ey] & ~field.rows[ey])
        const options: Placement[] = []
        const want = colors?.get(ey * WIDTH + ex)
        for (const piece of shuffle(random, [...PIECES])) {
            if (want ? want !== piece : !pieces.includes(piece)) continue
            for (const spot of placements(field.rows, piece, TUCK)) {
                const cells = SHAPES[piece][spot.rot].map(([dx, dy]) => [spot.x + dx, spot.y + dy])
                if (!cells.some(([x, y]) => x === ex && y === ey)) continue
                if (!cells.every(([x, y]) => target[y] >> x & 1 && !(field.rows[y] >> x & 1))) continue
                const tints = cells.map(([x, y]) => colors?.get(y * WIDTH + x))
                if (tints.some(tint => tint) && !tints.every(tint => tint === piece)) continue
                options.push(spot)
            }
        }
        for (const spot of shuffle(random, options)) {
            const next = place(field, spot).field
            if (!tileable(target, next.rows)) continue
            const done = visit(next, [...history, {field, piece: spot.piece}])
            if (done) return done
        }
        return null
    }
    return visit(base, [])
}
