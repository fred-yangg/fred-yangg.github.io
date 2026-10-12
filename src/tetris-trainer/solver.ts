import {kickTests, type KickTable} from './kicks.ts'
import {SHAPES, type Piece, type Rot} from './pieces.ts'
import {classifySpin, HEIGHT, SPAWN_X, SPAWN_Y, WIDTH, type Spin} from './rules.ts'

export type {Spin}

// Bitboard search over the same rules as the engine. A board is one 10-bit
// row mask per row, top row first. Bit x is column x.

export type Rows = Uint16Array
export type Move = 'L' | 'R' | 'D' | 'S' | 'CW' | 'CCW' | '180'

export type Objective =
    | {kind: 'pc'}
    // at: the T's own cells when it locks, when only one spot counts.
    // column: the column the T's middle cell has to lock in, like a well.
    | {kind: 'tspin'; lines: 1 | 2 | 3; at?: number[]; column?: number}
    // The board matches one of these exactly. None has a full row, so
    // building one never clears lines.
    | {kind: 'shape'; targets: Rows[]}

// Objectives met in order. A turn's stage is how many are done.
export type Goal = Objective[]

// drop: rotate and shift above the stack, then drop. No tucks or spins.
// tuck: also move and rotate after an instant soft drop. Puzzles are built
//   to be solvable this way, so 180° and slow soft drops are never needed.
// full: also 180° turns and one-row soft drops. Anything a player can do.
export type Options = {
    kick: KickTable
    moves: 'drop' | 'tuck' | 'full'
    hold?: boolean
    // Most turns a solver expands before giving up with OutOfBudget.
    budget?: number
}

// Thrown when a search runs past its budget. Answers already found stay valid.
export class OutOfBudget extends Error {}

export type Placement = {
    piece: Piece
    rot: Rot
    x: number
    y: number
    spin: Spin
}

export type Turn = {
    rows: Rows
    active: Piece | null
    queue: Piece[]
    hold: Piece | null
    canHold: boolean
    stage: number
}

export type Step = {
    hold: boolean
    placement: Placement
    lines: number
    after: Turn
    done: boolean
}

const FULL = (1 << WIDTH) - 1
const MOVES: Move[] = ['L', 'R', 'D', 'S', 'CW', 'CCW', '180']
const SPIN_RANK: Spin[] = ['none', 'mini', 'full']
const PIECE_LIST = Object.keys(SHAPES) as Piece[]
const PIECE_INDEX = Object.fromEntries(PIECE_LIST.map((piece, i) => [piece, i])) as Record<Piece, number>

const POP = new Uint8Array(1 << WIDTH)
for (let n = 1; n < POP.length; n++) POP[n] = POP[n >> 1] + (n & 1)

// Positions are indexed as (rot, x, y) with room for pieces hanging off the
// left edge and above the top.
const XO = 3
const XS = WIDTH + 6
const YO = 4
const YS = HEIGHT + 4
const SIZE = 4 * XS * YS

// Per piece and rotation: the occupied rows and, for every x, the row masks
// shifted into place (or nothing when the piece would leave the board).
type Shape = {
    dys: number[]
    maxY: number
    masks: (number[] | null)[]
    cells: readonly [number, number][]
}

const SHAPE: Shape[][] = PIECE_LIST.map(piece => SHAPES[piece].map(cells => {
    const byRow = new Map<number, number>()
    for (const [x, y] of cells) byRow.set(y, (byRow.get(y) ?? 0) | (1 << x))
    const dys = [...byRow.keys()].sort((a, b) => a - b)
    const minX = Math.min(...cells.map(([x]) => x))
    const maxX = Math.max(...cells.map(([x]) => x))
    const masks = Array.from({length: XS}, (_, i) => {
        const x = i - XO
        if (x + minX < 0 || x + maxX >= WIDTH) return null
        return dys.map(dy => x >= 0 ? byRow.get(dy)! << x : byRow.get(dy)! >> -x)
    })
    return {dys, maxY: Math.max(...cells.map(([, y]) => y)), masks, cells}
}))

// The same cells can come from two rotations (I, S, Z, O). Each spot maps to
// one canonical position so duplicates are dropped.
const CANON = PIECE_LIST.map(piece => SHAPES[piece].map(cells => {
    const key = (list: readonly [number, number][], dx: number, dy: number) => list.map(([x, y]) => `${x + dx},${y + dy}`).sort().join(' ')
    const own = key(cells, 0, 0)
    for (let rot = 0; rot < 4; rot++) {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dy = -2; dy <= 2; dy++) {
                if (key(SHAPES[piece][rot], dx, dy) === own) return {rot, dx, dy}
            }
        }
    }
    throw new Error('unreachable')
}))

// Kick offsets per table, piece, rotation and turn (CW, CCW, 180).
const KICKS = (['SRS+', 'SRS'] as const).map(table => PIECE_LIST.map(piece => [0, 1, 2, 3].map(from => [1, 3, 2].map(dir => kickTests(table, piece, from as Rot, ((from + dir) % 4) as Rot)))))

function fits(rows: Rows, p: number, rot: number, x: number, y: number): boolean {
    const shape = SHAPE[p][rot]
    const masks = shape.masks[x + XO]
    if (!masks || y + shape.maxY >= HEIGHT) return false
    const dys = shape.dys
    for (let i = 0; i < dys.length; i++) {
        const row = y + dys[i]
        if (row >= 0 && rows[row] & masks[i]) return false
    }
    return true
}

export function fitsRows(rows: Rows, piece: Piece, rot: Rot, x: number, y: number): boolean {
    if (x + XO < 0 || x + XO >= XS) return false
    return fits(rows, PIECE_INDEX[piece], rot, x, y)
}

function filled(rows: Rows, x: number, y: number): boolean {
    if (x < 0 || x >= WIDTH || y >= HEIGHT) return true
    if (y < 0) return false
    return (rows[y] >> x & 1) === 1
}

export function spinOf(rows: Rows, rot: Rot, x: number, y: number, kickIndex: number, quarter: boolean): Spin {
    return classifySpin((cx, cy) => filled(rows, cx, cy), rot, x, y, kickIndex, quarter)
}

export function lock(rows: Rows, piece: Piece, rot: Rot, x: number, y: number): {rows: Rows; lines: number} {
    const shape = SHAPE[PIECE_INDEX[piece]][rot]
    const masks = shape.masks[x + XO]!
    const next = rows.slice()
    for (let i = 0; i < shape.dys.length; i++) next[y + shape.dys[i]] |= masks[i]
    let write = HEIGHT - 1
    for (let read = HEIGHT - 1; read >= 0; read--) {
        if (next[read] === FULL) continue
        next[write--] = next[read]
    }
    const lines = write + 1
    for (; write >= 0; write--) next[write] = 0
    return {rows: next, lines}
}

// Breadth-first search over (rotation, x, y) from the spawn position.

const seen = new Int32Array(SIZE)
const parent = new Int32Array(SIZE)
const via = new Int8Array(SIZE)
const spinSeen = new Int32Array(SIZE)
const spinRank = new Int8Array(SIZE)
const spinParent = new Int32Array(SIZE)
const spinVia = new Int8Array(SIZE)
const order = new Int32Array(SIZE)
const keySeen = new Int32Array(SIZE)
let epoch = 0

function index(rot: number, x: number, y: number): number {
    return (rot * XS + x + XO) * YS + y + YO
}

function explore(rows: Rows, piece: Piece, options: Options): number {
    epoch++
    const p = PIECE_INDEX[piece]
    if (!fits(rows, p, 0, SPAWN_X, SPAWN_Y)) return 0
    const start = index(0, SPAWN_X, SPAWN_Y)
    seen[start] = epoch
    parent[start] = -1
    order[0] = start
    let count = 1
    const full = options.moves === 'full'
    const drop = options.moves === 'drop'
    const turns = piece === 'O' ? 0 : full ? 3 : 2
    const kicks = KICKS[options.kick === 'SRS+' ? 0 : 1][p]
    const isT = piece === 'T'
    for (let head = 0; head < count; head++) {
        const cur = order[head]
        if (drop && head > 0 && via[cur] === 3) continue
        const y = cur % YS - YO
        const t = (cur - y - YO) / YS
        const x = t % XS - XO
        const rot = (t - x - XO) / XS
        for (let move = 0; move < 4; move++) {
            let nx = x
            let ny = y
            if (move === 0) nx = x - 1
            else if (move === 1) nx = x + 1
            else if (!fits(rows, p, rot, x, y + 1)) break
            else if (move === 2) {
                if (!full) continue
                ny = y + 1
            } else {
                ny = y + 1
                while (fits(rows, p, rot, x, ny + 1)) ny++
            }
            if (move < 2 && !fits(rows, p, rot, nx, ny)) continue
            const i = index(rot, nx, ny)
            if (seen[i] === epoch) continue
            seen[i] = epoch
            parent[i] = cur
            via[i] = move
            order[count++] = i
        }
        for (let d = 0; d < turns; d++) {
            const to = (rot + (d === 0 ? 1 : d === 1 ? 3 : 2)) % 4
            const tests = kicks[rot][d]
            for (let k = 0; k < tests.length; k++) {
                const nx = x + tests[k][0]
                const ny = y - tests[k][1]
                if (!fits(rows, p, to, nx, ny)) continue
                if (ny + YO < 0) break
                const target = index(to, nx, ny)
                if (isT && !fits(rows, p, to, nx, ny + 1)) {
                    const rank = SPIN_RANK.indexOf(spinOf(rows, to as Rot, nx, ny, k, tests.length === 5))
                    if (spinSeen[target] !== epoch || rank > spinRank[target]) {
                        spinSeen[target] = epoch
                        spinRank[target] = rank
                        spinParent[target] = cur
                        spinVia[target] = 4 + d
                    }
                }
                if (seen[target] !== epoch) {
                    seen[target] = epoch
                    parent[target] = cur
                    via[target] = 4 + d
                    order[count++] = target
                }
                break
            }
        }
    }
    return count
}

// Every distinct resting spot. A T keeps its best spin for each spot.
export function placements(rows: Rows, piece: Piece, options: Options): Placement[] {
    const count = explore(rows, piece, options)
    const p = PIECE_INDEX[piece]
    const found: Placement[] = []
    for (let i = 0; i < count; i++) {
        const cur = order[i]
        const y = cur % YS - YO
        const t = (cur - y - YO) / YS
        const x = t % XS - XO
        const rot = (t - x - XO) / XS
        // Locking with a cell above the board is a lock out.
        if (y + SHAPE[p][rot].dys[0] < 0 || fits(rows, p, rot, x, y + 1)) continue
        const canon = CANON[p][rot]
        const key = index(canon.rot, x + canon.dx, y + canon.dy)
        if (keySeen[key] === epoch) continue
        keySeen[key] = epoch
        const spin = piece === 'T' && spinSeen[cur] === epoch ? SPIN_RANK[spinRank[cur]] : 'none'
        found.push({piece, rot: rot as Rot, x, y, spin})
    }
    return found
}

// The shortest input sequence that locks the piece at a placement, hard drop not included.
export function pathTo(rows: Rows, target: Placement, options: Options): Move[] | null {
    explore(rows, target.piece, options)
    const end = index(target.rot, target.x, target.y)
    if (seen[end] !== epoch) return null
    const moves: Move[] = []
    let cur = end
    if (target.spin !== 'none') {
        if (spinSeen[end] !== epoch || SPIN_RANK[spinRank[end]] !== target.spin) return null
        moves.push(MOVES[spinVia[end]])
        cur = spinParent[end]
    }
    while (parent[cur] !== -1) {
        moves.push(MOVES[via[cur]])
        cur = parent[cur]
    }
    return moves.reverse()
}

function sameRows(a: Rows, b: Rows): boolean {
    for (let y = 0; y < HEIGHT; y++) if (a[y] !== b[y]) return false
    return true
}

// A locked piece, as far as goals care.
export type Locked = {piece: Piece; rot: Rot; x: number; y: number; spin: Spin; lines: number}

// Board cells a piece covers, as y * WIDTH + x, sorted.
export function cellsOf(piece: Piece, rot: Rot, x: number, y: number): number[] {
    return SHAPES[piece][rot].map(([dx, dy]) => (y + dy) * WIDTH + x + dx).sort((a, b) => a - b)
}

// The stage a T goes to when it locks without the T-spin the goal wants next.
// Nothing comes after it: a wasted T is a wrong move.
export const WASTED = -1

// The stage after a lock. One lock meets at most one T-spin objective, but
// board objectives right after it can be met by the same lock.
export function progress(goal: Goal, stage: number, locked: Locked, rows: Rows): number {
    const {piece, spin, lines} = locked
    if (stage < 0) return stage
    const start = stage
    let spun = false
    while (stage < goal.length) {
        const objective = goal[stage]
        if (objective.kind === 'tspin') {
            if (spun || piece !== 'T' || spin !== 'full' || lines !== objective.lines) break
            if (objective.at && cellsOf(piece, locked.rot, locked.x, locked.y).join() !== objective.at.join()) break
            if (objective.column !== undefined && locked.x + 1 !== objective.column) break
            spun = true
        } else if (objective.kind === 'pc') {
            if (!lines || rows.some(row => row !== 0)) break
        } else if (!objective.targets.some(target => sameRows(target, rows))) break
        stage++
    }
    if (piece === 'T' && stage === start && goal[start]?.kind === 'tspin') return WASTED
    return stage
}

function pieceCount(turn: Turn): number {
    return (turn.active ? 1 : 0) + turn.queue.length + (turn.hold ? 1 : 0)
}

// Room left to grow into a target: nothing outside it, and few enough
// missing cells for the pieces left.
function inside(rows: Rows, target: Rows, pieces: number): boolean {
    let missing = 0
    for (let y = 0; y < HEIGHT; y++) {
        if (rows[y] & ~target[y]) return false
        missing += POP[target[y] & ~rows[y]]
    }
    return missing <= 4 * pieces
}

// Room to end on a target after more line clears: each row either stays,
// under its own row of the target, or fills up and clears. New empty rows come
// in at the top. Too many missing cells for the pieces left rules it out.
function canEndOn(rows: Rows, target: Rows, pieces: number): boolean {
    const budget = 4 * pieces
    // best[j]: fewest cells needed with the rows so far kept as target rows
    // up to j, counted from the bottom.
    let best = new Array<number>(HEIGHT + 1).fill(Infinity)
    best[0] = 0
    for (let i = HEIGHT - 1; i >= 0; i--) {
        const row = rows[i]
        const next = new Array<number>(HEIGHT + 1).fill(Infinity)
        for (let j = 0; j <= HEIGHT; j++) {
            if (best[j] > budget) continue
            const clear = best[j] + WIDTH - POP[row]
            if (clear < next[j]) next[j] = clear
            if (j < HEIGHT) {
                const want = target[HEIGHT - 1 - j]
                if (!(row & ~want)) {
                    const keep = best[j] + POP[want & ~row]
                    if (keep < next[j + 1]) next[j + 1] = keep
                }
            }
        }
        best = next
    }
    for (let j = 0; j <= HEIGHT; j++) {
        if (best[j] > budget) continue
        let top = best[j]
        for (let k = j; k < HEIGHT && top <= budget; k++) top += POP[target[HEIGHT - 1 - k]]
        if (top <= budget) return true
    }
    return false
}

// Lower bounds that rule a turn out without searching it.
function hopeless(turn: Turn, goal: Goal): boolean {
    const pieces = pieceCount(turn)
    if (pieces === 0 || turn.stage === WASTED) return true
    const left = goal.slice(turn.stage)
    const ts = (turn.active === 'T' ? 1 : 0) + (turn.hold === 'T' ? 1 : 0) + turn.queue.filter(piece => piece === 'T').length
    if (left.filter(objective => objective.kind === 'tspin').length > ts) return true
    if (left.some(objective => objective.kind === 'pc')) {
        // Every row with a cell in it has to clear.
        let need = 0
        for (const row of turn.rows) if (row) need += WIDTH - POP[row]
        if (need > 4 * pieces) return true
    }
    const next = left[0]
    if (next.kind === 'shape') return !next.targets.some(target => inside(turn.rows, target, pieces))
    if (next.kind === 'tspin') {
        // The T adds at most 4 cells to the rows it clears. Everything else
        // in those rows has to come from the pieces placed before it.
        let best = Infinity
        for (let top = 0; top + next.lines <= HEIGHT; top++) {
            let empty = 0
            for (let r = top; r < top + next.lines; r++) empty += WIDTH - POP[turn.rows[r]]
            best = Math.min(best, empty)
        }
        if (best - 4 > 4 * (pieces - 1)) return true
        // A clean finish after the spins still has to be reachable.
        const last = left[left.length - 1]
        if (last.kind === 'shape' && !left.some(objective => objective.kind === 'pc')) {
            return !last.targets.some(target => canEndOn(turn.rows, target, pieces))
        }
    }
    return false
}

function advance(rows: Rows, queue: Piece[], hold: Piece | null, stage: number): Turn {
    if (queue.length) return {rows, active: queue[0], queue: queue.slice(1), hold, canHold: true, stage}
    if (hold) return {rows, active: hold, queue: [], hold: null, canHold: true, stage}
    return {rows, active: null, queue: [], hold: null, canHold: true, stage}
}

// The pieces this turn can place, with what the queue and hold look like after.
function choices(turn: Turn, canHold: boolean): {piece: Piece; hold: boolean; queue: Piece[]; held: Piece | null}[] {
    const list: {piece: Piece; hold: boolean; queue: Piece[]; held: Piece | null}[] = []
    if (!turn.active) return list
    list.push({piece: turn.active, hold: false, queue: turn.queue, held: turn.hold})
    if (!turn.canHold || !canHold) return list
    if (turn.hold) {
        if (turn.hold !== turn.active) list.push({piece: turn.hold, hold: true, queue: turn.queue, held: turn.active})
    } else if (turn.queue.length && turn.queue[0] !== turn.active) {
        list.push({piece: turn.queue[0], hold: true, queue: turn.queue.slice(1), held: turn.active})
    }
    return list
}

function rowsKey(rows: Rows): string {
    return String.fromCharCode(...rows)
}

export function turnKey(turn: Turn): string {
    return `${rowsKey(turn.rows)}|${turn.active ?? '-'}|${turn.queue.join('')}|${turn.hold ?? '-'}|${turn.canHold ? 1 : 0}|${turn.stage}`
}

export type Solver = {
    steps: (turn: Turn) => Step[]
    solvable: (turn: Turn) => boolean
    solve: (turn: Turn) => Step[] | null
    // Sets a fresh budget. What the solver already worked out is kept.
    allow: (budget: number) => void
}

export function createSolver(goal: Goal, options: Options): Solver {
    const memo = new Map<string, boolean>()
    let left = options.budget ?? Infinity

    const steps = (turn: Turn): Step[] => {
        const list: Step[] = []
        for (const choice of choices(turn, options.hold !== false)) {
            for (const placement of placements(turn.rows, choice.piece, options)) {
                const locked = lock(turn.rows, placement.piece, placement.rot, placement.x, placement.y)
                const stage = progress(goal, turn.stage, {...placement, lines: locked.lines}, locked.rows)
                list.push({
                    hold: choice.hold,
                    placement,
                    lines: locked.lines,
                    after: advance(locked.rows, choice.queue, choice.held, stage),
                    done: stage === goal.length,
                })
            }
        }
        return list
    }

    const solvable = (turn: Turn): boolean => {
        if (hopeless(turn, goal)) return false
        const key = turnKey(turn)
        const known = memo.get(key)
        if (known !== undefined) return known
        if (--left < 0) throw new OutOfBudget()
        let ok = false
        for (const step of steps(turn)) {
            if (step.done || solvable(step.after)) {
                ok = true
                break
            }
        }
        memo.set(key, ok)
        return ok
    }

    const solve = (turn: Turn): Step[] | null => {
        const line: Step[] = []
        let cur = turn
        for (;;) {
            if (!solvable(cur)) return null
            const all = steps(cur)
            const done = all.find(step => step.done)
            if (done) {
                line.push(done)
                return line
            }
            const next = all.find(step => solvable(step.after))
            if (!next) return null
            line.push(next)
            cur = next.after
        }
    }

    return {steps, solvable, solve, allow: budget => { left = budget }}
}

export function rowsOf(board: ArrayLike<number>): Rows {
    const rows = new Uint16Array(HEIGHT)
    for (let y = 0; y < HEIGHT; y++) {
        let bits = 0
        for (let x = 0; x < WIDTH; x++) if (board[y * WIDTH + x]) bits |= 1 << x
        rows[y] = bits
    }
    return rows
}
