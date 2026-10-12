// Mid-game technique puzzles. Each generator draws a stack at one of the
// technique's starting points (see techniques/*.md), with a random preview a
// 7-bag could deal. The solver finds every way to make the spins, and the
// ideal finish is the cleanest board any of them leaves. A puzzle teaches the
// technique when one of its ideal finishes uses it. When none does, it's a
// wrong call: the board looks right, but the technique can't be done or
// something else is cleaner.

import {PIECES, type Piece} from './pieces.ts'
import {bagLegal} from './puzzles.ts'
import {HEIGHT, WIDTH} from './rules.ts'
import {cellsOf, createSolver, OutOfBudget, turnKey, type Goal, type Placement, type Rows, type Turn} from './solver.ts'
import {build, emptyField, encode, FULL, LINES, pick, place, popcount, shuffle, solvable, SWAP, TUCK, turnFrom, type Field, type Random, type Spin} from './stacking.ts'

export type Technique = {
    category: string
    goal: string
    field: Field
    queue: Piece[]
    after: string[]
    note: string
    source?: string
}

type Tidy = {holes: number; kept: number; step: number; bump: number}

// How clean a finish is, worst first: holes the solution made (cells the
// field started with have no color, so holes under them don't count), cells
// in the columns that should stay open, the step between a well's two sides
// (when even), then bumpiness.
function tidiness(field: Field, keep: number[], even: boolean, skip: number[] = []): Tidy {
    const out: Tidy = {holes: 0, kept: 0, step: 0, bump: 0}
    const h = new Array<number>(WIDTH).fill(0)
    for (let x = 0; x < WIDTH; x++) {
        let placed = false
        for (let y = 0; y < HEIGHT; y++) {
            const on = (field.rows[y] >> x & 1) === 1
            if (on && !h[x]) h[x] = HEIGHT - y
            if (keep.includes(x)) {
                if (on) out.kept++
            } else if (on) placed = field.colors.has(y * WIDTH + x)
            else if (placed && !skip.includes(x)) out.holes++
        }
    }
    for (let x = 0; x + 1 < WIDTH; x++) {
        if (!keep.includes(x) && !keep.includes(x + 1)) out.bump += Math.abs(h[x] - h[x + 1])
    }
    if (even) for (const x of keep) if (x > 0 && x < WIDTH - 1) out.step += Math.abs(h[x - 1] - h[x + 1])
    return out
}

const score = ({holes, kept, step, bump}: Tidy) => ((holes * 100 + kept) * 100 + step) * 100 + bump

// Finishes this close in bumpiness to the cleanest one are just as good.
const BUMP = 2

const shape = ({holes, kept, step}: Tidy) => (holes * 100 + kept) * 100 + step

// A T-spin on the way to a finish, with the field just before the T locked.
type Spun = {field: Field; spot: Placement}

// Whether a way to a finish used the technique.
type Tag = (spins: Spun[], after: Field) => boolean

type Verdict = {
    // The ideal finishes: the cleanest, and any about as clean.
    after: string[]
    best: Tidy
    // Some ideal finish uses the technique.
    tagged: boolean
    // The cleanest finish that uses it, if any does.
    near: Tidy | null
    // Some finish makes a hole or covers an open column that the best doesn't.
    unclean: boolean
}

// Positions with more ways to play than this are dropped.
const WALK = 12_000

// colored: the tag looks at which piece covers a cell, so ways to the same
// board with different pieces are told apart.
function judge(goal: Goal, field: Field, queue: Piece[], keep: number[], even: boolean, tag: Tag, colored: boolean): Verdict | null {
    const solver = createSolver(goal, {...TUCK, budget: 200_000})
    const seen = new Set<string>()
    const finals = new Map<string, {rows: Rows; tidy: Tidy; tagged: boolean}>()
    // now: the field as the tags see it. mine: the same, with only the
    // placed cells colored.
    const walk = (turn: Turn, now: Field, mine: Field, spins: Spun[]) => {
        for (const step of solver.steps(turn)) {
            const next = place(now, step.placement).field
            const made = place(mine, step.placement).field
            const spun = step.placement.piece === 'T' && step.after.stage > turn.stage && goal[turn.stage].kind === 'tspin'
            const path = spun ? [...spins, {field: now, spot: step.placement}] : spins
            if (step.done) {
                const key = String.fromCharCode(...step.after.rows)
                const tagged = tag(path, next)
                // A TST leaves its overhang over the T's column.
                const tidy = tidiness(made, keep, even, path.filter(spin => cleared(spin).length === 3).map(middle))
                const old = finals.get(key)
                if (!old) finals.set(key, {rows: step.after.rows, tidy, tagged})
                else {
                    old.tagged ||= tagged
                    if (score(tidy) < score(old.tidy)) old.tidy = tidy
                }
                continue
            }
            const key = `${colored ? encode(next) : ''}|${turnKey(step.after)}|${path.map(({spot}) => `${spot.rot}.${spot.x}.${spot.y}`).join()}`
            if (seen.has(key) || !solver.solvable(step.after)) continue
            if (seen.size >= WALK) throw new OutOfBudget()
            seen.add(key)
            walk(step.after, next, made, path)
        }
    }
    try {
        walk(turnFrom(field.rows, queue, null), field, {rows: field.rows, colors: new Map()}, [])
    } catch (error) {
        if (error instanceof OutOfBudget) return null
        throw error
    }
    const all = [...finals.values()].sort((a, b) => score(a.tidy) - score(b.tidy))
    if (!all.length) return null
    const best = all[0].tidy
    const ideal = all.filter(item => shape(item.tidy) === shape(best) && item.tidy.bump <= best.bump + BUMP)
    const used = all.filter(item => item.tagged)
    return {
        after: ideal.map(item => encode({rows: item.rows, colors: new Map()})),
        best,
        tagged: ideal.some(item => item.tagged),
        near: used[0]?.tidy ?? null,
        unclean: all.some(item => item.tidy.holes > best.holes || item.tidy.kept > best.kept),
    }
}

// Rows the T fills up, top first.
function cleared({field, spot}: Spun): number[] {
    const rows = field.rows.slice()
    for (const cell of cellsOf('T', spot.rot, spot.x, spot.y)) rows[Math.floor(cell / WIDTH)] |= 1 << cell % WIDTH
    const out: number[] = []
    rows.forEach((row, y) => {
        if (row === FULL) out.push(y)
    })
    return out
}

// Whether a column has a cell over an empty one.
function covered(rows: Rows, x: number): boolean {
    let roof = false
    for (let y = 0; y < HEIGHT; y++) {
        if (rows[y] >> x & 1) roof = true
        else if (roof) return true
    }
    return false
}

const middle = (spin: Spun) => spin.spot.x + 1

// The T-spin clears every row the column was covered in, so it's open again.
const donates = (c: number): Tag => (spins, after) => spins.length === 1
    && cleared(spins[0]).every(y => (spins[0].field.rows[y] >> c & 1) === 1)
    && !covered(after.rows, c)

// A donation whose cover is an S or Z standing in the column.
const kaidan = (c: number): Tag => (spins, after) => donates(c)(spins, after)
    && cleared(spins[0]).every(y => ['S', 'Z'].includes(spins[0].field.colors.get(y * WIDTH + c) ?? ''))

// The first TSD opens a second slot right under it.
const fractal: Tag = spins => spins.length === 2
    && middle(spins[0]) === middle(spins[1])
    && cleared(spins[1])[0] === cleared(spins[0])[1] + 1

// The first T stands sideways in the notch, and the second spins next to it.
const stsd: Tag = spins => spins.length === 2
    && spins[0].spot.rot % 2 === 1
    && Math.abs(middle(spins[0]) - middle(spins[1])) <= 1

const always: Tag = () => true

// A start: the stack, the pieces the preview brings besides the Ts, and the
// columns the finish should leave open.
type Start = {
    field: Field
    pieces: Piece[]
    keep: number[]
    // The piece the technique hinges on. Swapping it out makes a wrong call.
    key?: Piece
}

// A stack drawn on gray rows. Columns are given unmirrored.
function sketch(flip: boolean) {
    const base = new Uint16Array(HEIGHT)
    const target = new Uint16Array(HEIGHT)
    const col = (x: number) => flip ? WIDTH - 1 - x : x
    return {
        base,
        target,
        col,
        gray: (y: number, open: number[]) => {
            base[y] = FULL & ~open.reduce((mask, x) => mask | 1 << col(x), 0)
            target[y] = base[y]
        },
        fill: (x: number, y: number) => {
            if (x >= 0 && x < WIDTH) target[y] |= 1 << col(x)
        },
        piece: (letter: Piece) => (flip ? SWAP[letter] ?? letter : letter) as Piece,
    }
}

type Sketch = ReturnType<typeof sketch>

const topRow = (rows: Rows, x: number) => rows.findIndex(row => (row >> x & 1) === 1)

// The cells to add, split into connected areas.
function areas(target: Rows, base: Rows): number[][] {
    const left = Array.from(target, (row, y) => row & ~base[y])
    const out: number[][] = []
    for (let y = HEIGHT - 1; y >= 0; y--) {
        while (left[y]) {
            const x0 = 31 - Math.clz32(left[y] & -left[y])
            left[y] &= ~(1 << x0)
            const area: number[] = []
            const todo = [[x0, y]]
            while (todo.length) {
                const [x, cy] = todo.pop()!
                area.push(cy * WIDTH + x)
                for (const [nx, ny] of [[x - 1, cy], [x + 1, cy], [x, cy - 1], [x, cy + 1]]) {
                    if (nx < 0 || nx >= WIDTH || ny < 0 || ny >= HEIGHT || !(left[ny] >> nx & 1)) continue
                    left[ny] &= ~(1 << nx)
                    todo.push([nx, ny])
                }
            }
            out.push(area)
        }
    }
    return out
}

// Trims column tops until every area of cells to add holds whole pieces.
// Each free column comes with the row its top can't go below. With grow,
// stacks cells on free columns instead.
function roundOff(random: Random, target: Rows, base: Rows, free: [number, number][], grow = false): boolean {
    for (let guard = 0; guard < 40; guard++) {
        const odd = areas(target, base).find(area => area.length % 4)
        if (!odd) return true
        const tops = free.map(([x, floor]) => {
            const top = topRow(target, x)
            return {x, floor, top: top < 0 ? HEIGHT : top}
        })
        // Growing adds a cell on top of a column, touching the area.
        const touches = (x: number, y: number) => [[x - 1, y], [x + 1, y], [x, y + 1]].some(([nx, ny]) => odd.includes(ny * WIDTH + nx))
        const options = tops.filter(({x, floor, top}) => grow ? top > 0 && touches(x, top - 1) : top < HEIGHT && top < floor && odd.includes(top * WIDTH + x))
        if (!options.length) return false
        const {x, top} = pick(random, options)
        if (grow) target[top - 1] |= 1 << x
        else target[top] &= ~(1 << x)
    }
    return false
}

// Builds the sketch out of real pieces on its gray rows.
function stack(random: Random, s: Sketch, free: [number, number][], grow = false, colors?: Map<number, string>): Field | null {
    if (!roundOff(random, s.target, s.base, free.map(([x, floor]) => [s.col(x), floor]), grow)) return null
    const history = build(random, {rows: s.base, colors: new Map()}, s.target, colors)
    return history ? history[history.length - 1].field : null
}

// Random rows on top of a column, up to `most`.
function heap(random: Random, s: Sketch, x: number, top: number, most: number) {
    for (let h = Math.floor(random() * (most + 1)); h > 0; h--) s.fill(x, top - h)
}

const OTHERS = PIECES.filter(piece => piece !== 'T')

// Stairs down to an open column: each row reaches one cell further toward it.
// An S or Z stands in the column as the TSD's base.
function kaidanStart(random: Random): Start | null {
    const s = sketch(random() < 0.5)
    const c = random() < 0.5 ? WIDTH - 1 : 4 + Math.floor(random() * 5)
    const garbage = 1 + Math.floor(random() * 3)
    for (let i = 0; i < garbage; i++) s.gray(HEIGHT - 1 - i, [c])
    const low = HEIGHT - 1 - garbage
    for (let i = 0; i < 4; i++) for (let x = 0; x < c - i; x++) s.fill(x, low - i)
    // Across the column, the other side already holds the rows the TSD clears.
    const free: [number, number][] = []
    for (let x = c + 1; x < WIDTH; x++) {
        for (let y = low - 3 - Math.floor(random() * 2); y <= low; y++) s.fill(x, y)
        free.push([x, low - 3])
    }
    // Sometimes the row above the stairs already reaches over the slot.
    const natural = random() < 0.5
    if (natural) {
        s.fill(c - 3, low - 4)
        s.fill(c - 4, low - 4)
    }
    for (let x = 0; x < c - 4; x++) {
        heap(random, s, x, low - 3, 2)
        free.push([x, low - 3])
    }
    const field = stack(random, s, free)
    if (!field) return null
    const key = s.piece('Z')
    return {field, pieces: natural ? [key] : [key, pick(random, ['O', 'I', 'J', 'L'] as Piece[])], keep: [s.col(c)], key}
}

// An open column with a TSD slot beside it, where the slot's rows cross the
// column. The whole setup is built with one piece covering the column, then
// that piece is taken back: the TSD will clear the rows it covers.
function donationStart(random: Random): Start | null {
    const s = sketch(random() < 0.5)
    const c = Math.floor(random() * WIDTH)
    const garbage = 1 + Math.floor(random() * 3)
    for (let i = 0; i < garbage; i++) s.gray(HEIGHT - 1 - i, [c])
    const b = HEIGHT - 1 - garbage
    const a = b - 1
    // Covers whose cells in the column are all in the two rows that clear.
    const covers = ([
        {piece: 'O', cells: [[c, a], [c + 1, a], [c, b], [c + 1, b]]},
        {piece: 'O', cells: [[c - 1, a], [c, a], [c - 1, b], [c, b]]},
        {piece: 'L', cells: [[c, a], [c + 1, a], [c + 2, a], [c, b]]},
        {piece: 'J', cells: [[c - 2, a], [c - 1, a], [c, a], [c, b]]},
    ] as {piece: Piece; cells: [number, number][]}[]).filter(cover => cover.cells.every(([x]) => x >= 0 && x < WIDTH))
    const cover = pick(random, covers)
    const columns = new Set(cover.cells.map(([x]) => x))
    const stems = [...Array(WIDTH - 2).keys()].map(x => x + 1).filter(t => ![t - 1, t, t + 1].some(x => x === c || columns.has(x)))
    if (!stems.length) return null
    const t = pick(random, stems)
    const sides = [-1, 1].filter(side => [t + side, t + 2 * side].every(x => x >= 0 && x < WIDTH && x !== c && !columns.has(x)))
    if (!sides.length) return null
    const side = pick(random, sides)
    const tee = new Set([[t - 1, a], [t, a], [t + 1, a], [t, b]].map(([x, y]) => y * WIDTH + x))
    for (const y of [a, b]) for (let x = 0; x < WIDTH; x++) if (x !== c && !tee.has(y * WIDTH + x)) s.fill(x, y)
    const key = s.piece(cover.piece)
    const colors = new Map<number, string>()
    for (const [x, y] of cover.cells) {
        s.fill(x, y)
        colors.set(y * WIDTH + s.col(x), key)
    }
    const natural = random() < 0.6
    if (natural) {
        s.fill(t + side, a - 1)
        s.fill(t + 2 * side, a - 1)
    }
    const free: [number, number][] = []
    for (let x = 0; x < WIDTH; x++) {
        if (x === c || columns.has(x) || Math.abs(x - t) <= 1) continue
        heap(random, s, x, a, 2)
        free.push([x, natural && x === t + 2 * side ? a - 1 : a])
    }
    const field = stack(random, s, free, true, colors)
    if (!field) return null
    for (const cell of colors.keys()) {
        field.rows[Math.floor(cell / WIDTH)] &= ~(1 << cell % WIDTH)
        field.colors.delete(cell)
    }
    return {field, pieces: natural ? [key] : [key, pick(random, OTHERS)], keep: [s.col(c)], key}
}

// A 3×3 empty space beside the stack, sometimes over a Tetris column. A J
// makes the notch, another piece the overhang, and two Ts spin.
function stsdStart(random: Random): Start | null {
    const s = sketch(random() < 0.5)
    const g = random() < 0.5 ? 0 : 1 + Math.floor(random() * 4)
    const well = random() < 0.4 ? g + 1 : -1
    const garbage = well < 0 ? 0 : 1 + Math.floor(random() * 3)
    for (let i = 0; i < garbage; i++) s.gray(HEIGHT - 1 - i, [well])
    const low = HEIGHT - 1 - garbage
    const free: [number, number][] = []
    for (let x = 0; x < g; x++) {
        for (let y = low - 2; y <= low; y++) s.fill(x, y)
        heap(random, s, x, low - 2, 2)
        free.push([x, low - 2])
    }
    for (const x of [g + 3, g + 4]) for (let y = low - 2; y <= low; y++) s.fill(x, y)
    for (let x = g + 5; x < WIDTH; x++) {
        for (let y = low - 3; y <= low; y++) s.fill(x, y)
        heap(random, s, x, low - 3, 1)
        free.push([x, low - 3])
    }
    const field = stack(random, s, free)
    if (!field) return null
    const key = s.piece('J')
    return {field, pieces: [key, s.piece(pick(random, ['Z', 'O', 'I', 'L', 'S'] as Piece[]))], keep: well < 0 ? [] : [s.col(well)], key}
}

// Two TSD slots stacked, built from pieces, then the top two or three pieces
// taken back. The lower slot stays.
function fractalStart(random: Random): Start | null {
    const s = sketch(random() < 0.5)
    const garbage = Math.floor(random() * 3)
    let gap = Math.floor(random() * WIDTH)
    for (let i = 0; i < garbage; i++) {
        if (random() < 0.5) gap = Math.floor(random() * WIDTH)
        s.gray(HEIGHT - 1 - i, [gap])
    }
    const low = HEIGHT - 1 - garbage
    const t = 2 + Math.floor(random() * 7)
    for (const y of [low, low - 2]) for (let x = 0; x < WIDTH; x++) if (x !== t) s.fill(x, y)
    for (const y of [low - 1, low - 3]) for (let x = 0; x < WIDTH; x++) if (Math.abs(x - t) > 1) s.fill(x, y)
    s.fill(t - 1, low - 4)
    s.fill(t - 2, low - 4)
    const free: [number, number][] = []
    for (let x = 0; x < WIDTH; x++) {
        if (x >= t - 2 && x <= t + 1) continue
        heap(random, s, x, low - 3, 1)
        free.push([x, low - 3])
    }
    if (!roundOff(random, s.target, s.base, free.map(([x, floor]) => [s.col(x), floor]))) return null
    const history = build(random, {rows: s.base, colors: new Map()}, s.target)
    if (!history) return null
    const done = history[history.length - 1].field
    for (const back of shuffle(random, [2, 3])) {
        if (history.length <= back) continue
        const before = history[history.length - 1 - back].field
        const pieces = history.slice(-1 - back, -1).map(item => item.piece)
        // The lower slot and its overhang stay built.
        if ([low - 2, low - 1, low].some(y => before.rows[y] !== done.rows[y])) continue
        return {field: before, pieces, keep: [], key: pick(random, pieces)}
    }
    return null
}

// TST starting points: a one-cell notch at the bottom of a 3-wide gap, or a
// stack that steps down twice into a 1-wide well. The pieces are the ones
// that finish the TST slot from there: the T stands in column x pointing left
// into a pocket, under a roof two rows over x.
function tstStart(random: Random): Start | null {
    const s = sketch(random() < 0.5)
    const floor = HEIGHT - 1
    let x: number
    const free: [number, number][] = []
    if (random() < 0.5) {
        // Notch: gap at columns g..g+2, its middle cell filled at the bottom.
        const g = random() < 0.5 ? 0 : 1 + Math.floor(random() * 5)
        x = g + 2
        for (let c = 0; c < WIDTH; c++) {
            if (c >= g && c <= g + 2) continue
            for (let y = floor - 2; y <= floor; y++) s.fill(c, y)
            if (c === x + 1) continue
            heap(random, s, c, floor - 2, 1)
            free.push([c, floor - 2])
        }
        s.base[floor] |= 1 << s.col(g + 1)
        s.fill(g + 1, floor)
    } else {
        // Two-step stair down into a well at column x.
        x = 2 + Math.floor(random() * 6)
        for (let c = 0; c < WIDTH; c++) {
            const top = c < x - 1 ? 2 : c === x - 1 ? 1 : c === x ? 0 : 4
            for (let y = floor - top + 1; y <= floor; y++) s.fill(c, y)
            if (c !== x - 1 && c !== x && c !== x + 1) free.push([c, floor - top + 1])
        }
    }
    const field = stack(random, s, free, true)
    if (!field) return null
    // The slot: rows floor-2..floor full but for the T and the pocket at x-1
    // in the middle row, and a roof over x two rows up.
    const slot = field.rows.slice()
    const put = (c: number, y: number) => {
        slot[y] |= 1 << s.col(c)
    }
    for (let y = floor - 2; y <= floor; y++) for (let c = 0; c < WIDTH; c++) if (c !== x && !(c === x - 1 && y === floor - 1)) put(c, y)
    put(x + 1, floor - 3)
    put(x + 1, floor - 4)
    put(x, floor - 4)
    const grow = free.filter(([c]) => c !== x + 1).map(([c]): [number, number] => [s.col(c), floor - 2])
    if (!grow.length || !roundOff(random, slot, field.rows, grow, true)) return null
    // No Ts: the one in the preview is for the spin.
    const history = build(random, field, slot, undefined, OTHERS)
    if (!history || history.length - 1 > 4) return null
    return {field, pieces: history.slice(0, -1).map(item => item.piece), keep: []}
}

type Notch = {width: number; depth: number}

// The most pieces a height difference puzzle takes before the T.
const MOST = 5

// Every way to take a notch out of each side of a center well, next to it,
// that leaves the two columns beside the well at different heights. Wells
// sit in columns 2-7, so each side is at least 2 wide.
function heightShapes(): {well: number; left: Notch; right: Notch}[] {
    const notches = (side: number): Notch[] => [
        {width: 0, depth: 0},
        ...[1, 2, 3].flatMap(depth => Array.from({length: side}, (_, i) => ({width: i + 1, depth}))),
    ]
    const out: {well: number; left: Notch; right: Notch}[] = []
    for (let well = 2; well <= 7; well++) {
        for (const left of notches(well)) {
            for (const right of notches(WIDTH - 1 - well)) if (left.depth !== right.depth) out.push({well, left, right})
        }
    }
    return out
}

// A gray stack around a center well with a notch out of each side. The
// pieces are the ones that build a TSD slot over the well from it.
function heightStart(random: Random, well: number, left: Notch, right: Notch): Start | null {
    const rows = Math.max(left.depth, right.depth) + 1 + Math.floor(random() * 2)
    const field = emptyField()
    for (let i = 0; i < rows; i++) field.rows[HEIGHT - 1 - i] = FULL & ~(1 << well)
    const top = HEIGHT - rows
    for (let d = 0; d < left.depth; d++) for (let x = well - left.width; x < well; x++) field.rows[top + d] &= ~(1 << x)
    for (let d = 0; d < right.depth; d++) for (let x = well + 1; x <= well + right.width; x++) field.rows[top + d] &= ~(1 << x)
    // Even the two sides at the higher neighbor (or a row above it), fill in
    // to the T's arms, and put an overhang over one arm.
    const stem = top + Math.min(left.depth, right.depth) - (random() < 0.3 ? 1 : 0)
    const arms = stem - 1
    const s = sketch(false)
    s.base.set(field.rows)
    s.target.set(field.rows)
    for (let x = 0; x < WIDTH; x++) {
        if (x === well) continue
        for (let y = Math.abs(x - well) === 1 ? stem : arms; y < HEIGHT; y++) s.fill(x, y)
    }
    const sides = [-1, 1].filter(side => well + 2 * side >= 0 && well + 2 * side < WIDTH)
    const side = pick(random, sides)
    s.fill(well + side, arms - 1)
    s.fill(well + 2 * side, arms - 1)
    const free: [number, number][] = []
    for (let x = 0; x < WIDTH; x++) if (Math.abs(x - well) > 1) free.push([x, arms])
    if (!roundOff(random, s.target, s.base, free, true)) return null
    let cells = 0
    for (let y = 0; y < HEIGHT; y++) cells += popcount(s.target[y] & ~s.base[y])
    if (cells > 4 * MOST) return null
    // No Ts: the one in the preview is for the spin.
    const history = build(random, field, s.target, undefined, OTHERS)
    if (!history) return null
    return {field, pieces: history.slice(0, -1).map(item => item.piece), keep: [well]}
}

type Spec = {
    category: string
    name: string
    kinds: Spin[]
    // Technique puzzles and wrong calls to find.
    want: number
    wrong: number
    tries: number
    make: () => Start | null
    tag: (start: Start) => Tag
    // The tag looks at piece colors.
    colored?: boolean
    // The finish should also bring the well's two sides level.
    even?: boolean
    // The spin has to be over the first column kept open.
    pin?: boolean
    lesson: string
    source?: string
}

// Why the technique isn't the answer, for a wrong call.
function wrongNote(spec: Spec, verdict: Verdict, missing: Piece | null): string {
    const name = `Not a ${spec.name} here`
    if (!verdict.near) return missing ? `${name}: there’s no ${missing} in reach for it.` : `${name}: these pieces can’t make one.`
    const a = verdict.near
    const b = verdict.best
    const worse = a.holes > b.holes
        ? 'leaves a hole'
        : a.kept > b.kept
            ? 'covers the open column'
            : a.step > b.step
                ? 'leaves the sides of the well further apart'
                : 'leaves a bumpier stack'
    return `${name}. One works, but it ${worse} than the best finish.`
}

function run(random: Random, spec: Spec, log: (text: string) => void): Technique[] {
    const out: Technique[] = []
    let right = 0
    let wrong = 0
    // Why candidates were dropped, for the log.
    const misses = {build: 0, queue: 0, spins: 0, search: 0, messy: 0, easy: 0}
    for (let i = 0; i < spec.tries && (right < spec.want || wrong < spec.wrong); i++) {
        const start = spec.make()
        if (!start) {
            misses.build++
            continue
        }
        // Sometimes take the key piece away, so the board looks right but the
        // queue says no.
        const missing = start.key && wrong < spec.wrong && random() < 0.3 ? start.key : null
        const pieces = start.pieces.map(piece => piece === missing ? pick(random, OTHERS.filter(other => other !== missing)) : piece)
        const ts: Piece[] = spec.kinds.map(() => 'T')
        // A spare piece now and then, and always without the key piece, so
        // there's another way to play. Two-spin setups leave few ways to
        // play without one.
        const spare = missing || (spec.kinds.length === 1 ? pieces.length < 4 && random() < 0.3 : random() < 0.5) ? [pick(random, OTHERS)] : []
        const spins: Goal = spec.kinds.map(kind => spec.pin ? {kind: 'tspin', lines: LINES[kind], column: start.keep[0]} : {kind: 'tspin', lines: LINES[kind]})
        const rows = start.field.rows
        if (solvable(spins, turnFrom(rows, ts, null))) {
            misses.spins++
            continue
        }
        // A random order, or else the order the pieces were built in.
        const orders = [preview(random, [...pieces, ...ts, ...spare]), [...pieces, ...ts, ...spare]]
            .filter((order): order is Piece[] => order !== null && bagLegal(order))
        if (!orders.length) {
            misses.queue++
            continue
        }
        const queue = orders.find(order => quick(spins, turnFrom(rows, order, null)))
        if (!queue) {
            misses.spins++
            continue
        }
        const verdict = judge(spins, start.field, queue, start.keep, spec.even ?? false, spec.tag(start), spec.colored ?? false)
        if (!verdict) {
            misses.search++
            continue
        }
        // The ideal finish keeps the open columns open and makes no holes.
        const before = tidiness({rows, colors: new Map()}, start.keep, false)
        if (verdict.best.kept > before.kept || verdict.best.holes > 0) {
            misses.messy++
            continue
        }
        // And some other finish doesn't, so the clean one takes finding.
        if (!verdict.unclean) {
            misses.easy++
            continue
        }
        if (verdict.tagged ? right >= spec.want : wrong >= spec.wrong) continue
        const goal = spec.kinds.map(kind => spec.pin ? `${kind}@col${start.keep[0]}` : kind).join(' ')
        out.push({
            category: spec.category,
            goal: `${goal} clean`,
            field: start.field,
            queue,
            after: verdict.after,
            note: verdict.tagged ? spec.lesson : wrongNote(spec, verdict, missing),
            source: spec.source,
        })
        if (verdict.tagged) right++
        else wrong++
    }
    log(`${spec.category} ${right} + ${wrong} wrong calls (dropped: ${Object.entries(misses).map(([why, count]) => `${count} ${why}`).join(', ')})`)
    return out
}

// Solvable with both kick tables, giving up early on big searches.
function quick(goal: Goal, turn: Turn): boolean {
    try {
        return createSolver(goal, {...TUCK, budget: 40_000}).solvable(turn) && createSolver(goal, {...TUCK, kick: 'SRS', budget: 40_000}).solvable(turn)
    } catch (error) {
        if (error instanceof OutOfBudget) return false
        throw error
    }
}

// The pieces in an order a 7-bag could deal them.
function preview(random: Random, pieces: Piece[]): Piece[] | null {
    for (let i = 0; i < 60; i++) {
        const queue = shuffle(random, pieces.slice())
        if (bagLegal(queue)) return queue
    }
    return null
}

// The puzzles for one technique's category. scale shrinks its counts, for
// splitting it into parts or trying it out.
export function techniquePuzzles(random: Random, log: (text: string) => void, category: string, scale = 1): Technique[] {
    const n = (count: number) => Math.ceil(count * scale)
    const specs: Spec[] = [
        {
            category: 'tsd/kaidan',
            name: 'Kaidan',
            kinds: ['tsd'],
            want: n(30),
            wrong: n(10),
            tries: n(600),
            make: () => kaidanStart(random),
            tag: start => kaidan(start.keep[0]),
            colored: true,
            lesson: 'Kaidan: the S or Z stands in the open column as the TSD’s base, and the TSD clears it, so the column is open again.',
            source: 'https://four.lol/methods/kaidan',
        },
        {
            category: 'tsd/donation',
            name: 'donation',
            kinds: ['tsd'],
            want: n(25),
            // Without the cover, no other TSD fits these boards.
            wrong: 0,
            tries: n(4000),
            make: () => donationStart(random),
            tag: start => donates(start.keep[0]),
            lesson: 'Donation: a piece covers the open column for a moment, and the TSD clears the rows it covers, so the column is open again.',
            source: 'https://four.lol/mid-game/donation',
        },
        {
            category: 'tsd/fractal',
            name: 'Fractal',
            kinds: ['tsd', 'tsd'],
            want: n(25),
            wrong: n(8),
            tries: n(4000),
            make: () => fractalStart(random),
            tag: () => fractal,
            lesson: 'Fractal: build the second slot on top of the first, so the first TSD opens the one under it.',
            source: 'https://four.lol/methods/fractal',
        },
        {
            category: 'tsd/stsd',
            name: 'STSD',
            kinds: ['tsd', 'tsd'],
            want: n(25),
            // Without the J, no other pair of TSDs fits these boards.
            wrong: 0,
            tries: n(8000),
            make: () => stsdStart(random),
            tag: () => stsd,
            lesson: 'STSD: the first T turns into the deep notch with the TST kick, then the second T does a TSD in the slot it leaves.',
            source: 'https://four.lol/methods/stsd',
        },
        {
            category: 'tst/methods',
            name: 'TST',
            kinds: ['tst'],
            want: n(40),
            wrong: 0,
            tries: n(800),
            make: () => tstStart(random),
            tag: () => always,
            lesson: 'A TST always leaves an overhang behind. The cleanest finish plans for it.',
            source: 'https://four.lol/methods/tspin-triple',
        },
    ]
    const spec = specs.find(item => item.category === category)
    if (!spec) throw new Error(`no technique ${category}`)
    return run(random, spec, log)
}

// Height difference puzzles over wells in these columns: one per shape until
// each step size has `want`. Few 3-row shapes fit in five pieces, so they get
// a second pass. verbose logs every shape.
export function heightPuzzles(random: Random, log: (text: string) => void, wells: number[], want: Record<number, number>, verbose = false): Technique[] {
    const out: Technique[] = []
    const shapes = shuffle(random, heightShapes().filter(shape => wells.includes(shape.well)))
    const found: Record<number, number> = {1: 0, 2: 0, 3: 0}
    const used = new Set<number>()
    for (const [i, shape] of [...shapes.entries(), ...shapes.entries()]) {
        const step = Math.abs(shape.left.depth - shape.right.depth)
        if (used.has(i) || found[step] >= want[step]) continue
        const made = run(random, {
            category: `height/${step}`,
            name: 'height difference',
            kinds: ['tsd'],
            want: 1,
            wrong: 0,
            tries: step === 3 ? 10 : 3,
            make: () => heightStart(random, shape.well, shape.left, shape.right),
            tag: () => always,
            even: true,
            pin: true,
            lesson: 'Even the two columns next to the well, fill in up to the T’s arms, build the overhang, then spin.',
        }, text => {
            if (verbose) log(text)
        })
        if (made.length) used.add(i)
        found[step] += made.length
        out.push(...made)
    }
    log(`${found[1]} + ${found[2]} + ${found[3]} of ${shapes.length} shapes`)
    return out
}
