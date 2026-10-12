// Makes the puzzle bank from the setups in setups.ts and from generated
// mid-game T-spins, in parts that run.mjs makes side by side. Every queue
// could come out of a 7-bag, and every puzzle is solved here without 180°
// turns or slow soft drops.
//
//   pnpm tetris-puzzles [part...]

import {PIECES, type Piece} from './pieces.ts'
import {bagLegal, boardOf, goalOf, pieces, type Puzzle} from './puzzles.ts'
import {HEIGHT, WIDTH} from './rules.ts'
import {DIAGRAMS, type Diagram} from './setups.ts'
import {cellsOf, createSolver, lock, placements, rowsOf, turnKey, type Goal, type Placement, type Rows, type Turn} from './solver.ts'
import {
    bag,
    bags,
    build,
    drops,
    emptyField,
    encode,
    faults,
    fieldOf,
    FULL,
    heights,
    holes,
    LINES,
    mirror,
    mulberry,
    pick,
    piecesIn,
    place,
    popcount,
    shuffle,
    solvable,
    stackHeight,
    SWAP,
    TUCK,
    turnFrom,
    type Field,
    type History,
    type Random,
    type Spin,
} from './stacking.ts'
import {heightPuzzles, techniquePuzzles} from './techniques.ts'

function spinSpot(rows: Rows, lines: number): Placement | null {
    for (const spot of placements(rows, 'T', TUCK)) {
        if (spot.spin === 'full' && lock(rows, 'T', spot.rot, spot.x, spot.y).lines === lines) return spot
    }
    return null
}

const spinGoal = (kind: Spin): Goal => [{kind: 'tspin', lines: LINES[kind]}]

// Share of first moves that still win. Near 1 means nearly anything works.
function looseness(goal: Goal, start: Turn): number {
    const solver = createSolver(goal, TUCK)
    const seen = new Set<string>()
    let good = 0
    for (const step of solver.steps(start)) {
        const key = `${step.done} ${turnKey(step.after)}`
        if (seen.has(key)) continue
        seen.add(key)
        if (step.done || solver.solvable(step.after)) good++
    }
    return good / seen.size
}

// A board a solution can finish on, and the fewest holes a way there makes.
type Final = {rows: Rows; made: number}

// How messy a finish is: holes the solution made first, then bumpiness.
function mess({rows, made}: Final): number {
    const h = heights(rows)
    return made * 1000 + h.slice(1).reduce((sum, v, x) => sum + Math.abs(v - h[x]), 0)
}

// Every board a solution can finish on.
function finals(goal: Goal, start: Turn): Final[] {
    const solver = createSolver(goal, TUCK)
    const seen = new Set<string>()
    const found = new Map<string, Final>()
    const walk = (turn: Turn, field: Field) => {
        for (const step of solver.steps(turn)) {
            const next = place(field, step.placement).field
            if (step.done) {
                const key = String.fromCharCode(...step.after.rows)
                // A TST leaves its overhang over the T's column.
                const made = faults(next, step.lines === 3 ? [step.placement.x + 1] : [])
                if (made < (found.get(key)?.made ?? Infinity)) found.set(key, {rows: step.after.rows, made})
                continue
            }
            const key = `${encode(next)}|${turnKey(step.after)}`
            if (seen.has(key) || !solver.solvable(step.after)) continue
            seen.add(key)
            walk(step.after, next)
        }
    }
    walk(start, {rows: start.rows, colors: new Map()})
    return [...found.values()]
}

// The cleanest finishes. There has to be one that makes no holes and another
// that does, so the player has a clean finish to find. Nothing otherwise.
function ideal(goal: Goal, start: Turn): string[] | null {
    const boards = finals(goal, start)
    if (!boards.some(final => final.made === 0) || boards.every(final => final.made === 0)) return null
    const best = Math.min(...boards.map(mess))
    return boards.filter(final => mess(final) <= best).map(({rows}) => encode({rows, colors: new Map()}))
}

// A bag-legal order of mid-game pieces that still solves, or nothing.
function midgameQueue(random: Random, goal: Goal, rows: Rows, multiset: Piece[], works = (queue: Piece[]) => solvable(goal, turnFrom(rows, queue, null))): Piece[] | null {
    const tried = new Set<string>()
    for (let attempt = 0; attempt < 24 && tried.size < 120; attempt++) {
        const queue = shuffle(random, multiset.slice())
        const key = queue.join('')
        if (tried.has(key)) continue
        tried.add(key)
        if (!bagLegal(queue)) continue
        if (works(queue)) return queue
    }
    return null
}

// General T-spins, part 1: a stacker that likes leaving T-spin slots. When
// a slot appears, rewind one or two pieces. Those pieces plus a T are the puzzle.
function stackedTspin(random: Random, kind: Spin): {field: Field; queue: Piece[]}[] {
    const lines = LINES[kind]
    let field = emptyField()
    const garbage = Math.floor(random() * 3)
    let gap = Math.floor(random() * WIDTH)
    for (let g = 0; g < garbage; g++) {
        if (random() < 0.4) gap = Math.floor(random() * WIDTH)
        field.rows.copyWithin(0, 1)
        field.rows[HEIGHT - 1] = FULL & ~(1 << gap)
    }
    const sequence = bags(random, 8).filter(piece => piece !== 'T')
    const history: History = []
    const found: {field: Field; queue: Piece[]}[] = []
    for (let turn = 0; turn < sequence.length && found.length < 2; turn++) {
        const piece = sequence[turn]
        const options = drops(field.rows, piece).map(drop => {
            const next = place(field, drop)
            const slot = spinSpot(next.field.rows, lines) ? 6 + 4 * lines : 0
            return {next, score: stackScore(next.field.rows, next.lines) + slot + random() * 4}
        }).sort((a, b) => b.score - a.score)
        if (!options.length) break
        history.push({field, piece})
        field = options[0].next.field
        if (stackHeight(field.rows) > 10) break
        const spot = spinSpot(field.rows, lines)
        if (!spot) continue
        for (const back of random() < 0.6 ? [2, 1] : [1, 2]) {
            if (history.length < back) continue
            const before = history[history.length - back]
            if (spinSpot(before.field.rows, lines)) continue
            const setup = history.slice(-back).map(item => item.piece)
            const spare = random() < 0.3 ? [pick(random, [...PIECES].filter(p => p !== 'T'))] : []
            const queue = midgameQueue(random, spinGoal(kind), before.field.rows, [...setup, 'T', ...spare])
            if (queue) {
                found.push({field: before.field, queue})
                break
            }
        }
        // Take the T-spin and keep stacking on what's left.
        field = place(field, {piece: 'T', rot: spot.rot, x: spot.x, y: spot.y}).field
        history.length = 0
    }
    return found
}

// Scores a resting stack. Clean, a little uneven, and not too tall.
function stackScore(rows: Rows, lines: number): number {
    const h = heights(rows)
    const bump = h.slice(1).reduce((sum, v, x) => sum + Math.abs(v - h[x]), 0)
    const max = Math.max(...h)
    return -6 * holes(rows) - bump - 0.3 * h.reduce((a, b) => a + b, 0) - 3 * Math.max(0, max - 8) - 3 * lines
}

// General T-spins, part 2: textbook slots, flat rows with a T-spin hole and an
// overhang, built from pieces. Rewind the top pieces to make the puzzle.
function designedTspin(random: Random, kind: Spin): {field: Field; queue: Piece[]} | null {
    const base = emptyField()
    const garbage = Math.floor(random() * 3)
    let gap = Math.floor(random() * WIDTH)
    for (let g = 0; g < garbage; g++) {
        if (random() < 0.5) gap = Math.floor(random() * WIDTH)
        base.rows[HEIGHT - 1 - g] = FULL & ~(1 << gap)
    }
    const floor = HEIGHT - 1 - garbage
    const flip = random() < 0.5
    const col = (x: number) => flip ? WIDTH - 1 - x : x
    const target = base.rows.slice()
    const fill = (x: number, y: number) => { target[y] |= 1 << col(x) }
    const clear = (x: number, y: number) => { target[y] &= ~(1 << col(x)) }
    // Columns stack this many cells above the top cleared row.
    const heightsAbove = Array.from({length: WIDTH}, () => Math.floor(random() * 3))
    let top: number
    let x: number
    if (kind === 'tst') {
        // The T ends pointing right in column x + 1, under the overhang at
        // (x + 2, top). It gets there with the TST kick from under a roof
        // at (x + 1, top - 2).
        x = Math.floor(random() * 6)
        top = floor - 2
        for (let c = 0; c < WIDTH; c++) {
            if (c !== x + 1) fill(c, top)
            if (c !== x + 1 && c !== x + 2) fill(c, top + 1)
            if (c !== x + 1) fill(c, top + 2)
        }
        heightsAbove[x] = 2 + Math.floor(random() * 2)
        heightsAbove[x + 1] = 0
        heightsAbove[x + 2] = 0
        heightsAbove[x + 3] = 0
        fill(x + 1, top - 2)
    } else {
        // The T ends pointing down at columns x..x + 2, under the overhang
        // at (x, top - 1).
        x = 1 + Math.floor(random() * 7)
        top = floor - 1
        for (let c = 0; c < WIDTH; c++) {
            if (c < x || c > x + 2) fill(c, top)
            if (c !== x + 1) fill(c, top + 1)
        }
        heightsAbove[x] = 1 + Math.floor(random() * 2)
        heightsAbove[x - 1] = Math.max(heightsAbove[x - 1], 1)
        heightsAbove[x + 1] = 0
        heightsAbove[x + 2] = 0
        if (kind === 'tss') {
            // A dip in the upper row means only the lower row clears.
            const dip = pick(random, [...Array(WIDTH).keys()].filter(c => c < x - 1 || c > x + 3))
            if (dip === undefined) return null
            clear(dip, top)
            heightsAbove[dip] = 0
        }
    }
    for (let c = 0; c < WIDTH; c++) for (let h = 0; h < heightsAbove[c]; h++) fill(c, top - 1 - h)
    let cells = 0
    for (let y = 0; y <= floor; y++) cells += popcount(target[y])
    // Round to whole pieces by trimming column tops away from the slot.
    for (let guard = 0; cells % 4 && guard < 60; guard++) {
        const c = Math.floor(random() * WIDTH)
        if (heightsAbove[c] < (c === x ? 3 : 1) || (c > x - 2 && c < x + 4)) continue
        clear(c, top - heightsAbove[c])
        heightsAbove[c]--
        cells--
    }
    if (cells % 4) return null
    const history = build(random, base, target)
    if (!history) return null
    const lines = LINES[kind]
    if (!spinSpot(history[history.length - 1].field.rows, lines)) return null
    for (const back of shuffle(random, [1, 2, 3])) {
        if (history.length <= back) continue
        const setup = history.slice(-1 - back, -1).map(item => item.piece)
        if (setup.includes('T')) continue
        const before = history[history.length - 1 - back].field
        if (spinSpot(before.rows, lines)) continue
        const spare = back < 3 && random() < 0.2 ? [pick(random, [...PIECES].filter(p => p !== 'T'))] : []
        const queue = midgameQueue(random, spinGoal(kind), before.rows, [...setup, 'T', ...spare])
        if (queue) return {field: before, queue}
    }
    return null
}

// The same cells seen in a mirror.
function mirrorCells(cells: string): string {
    return cells.split('.').map(Number).map(cell => cell - cell % WIDTH + WIDTH - 1 - cell % WIDTH).sort((a, b) => a - b).join('.')
}

// Opener and perfect-clear puzzles carry where they are in the bags: the hold
// and the pieces left in the bag when the stage began, and the pieces dealt
// since. The setup on the board was really built from those pieces.
type Before = {hold: Piece | null; bag: number; pieces: Piece[]}

type Made = {
    category: string
    goal: string
    field: Field
    queue: Piece[]
    hold: Piece | null
    targets?: string
    after?: string[]
    source?: string
    note?: string
    before?: Before
}

// Deals `stream` onto `base` until `target` is built, the way a player could,
// and returns the state that leaves: the board, the hold, the rest of the stream.
function dealt(base: Field, target: string, stream: Piece[], hold: Piece | null, bagLeft: number): Pick<Made, 'field' | 'queue' | 'hold' | 'before'> | null {
    const goal: Goal = [{kind: 'shape', targets: [rowsOf(boardOf(target))]}]
    const steps = createSolver(goal, TUCK).solve(turnFrom(base.rows, stream, hold))
    if (!steps) return null
    let field = base
    for (const step of steps) field = place(field, step.placement).field
    const end = steps[steps.length - 1].after
    const queue = end.active ? [end.active, ...end.queue] : end.queue
    return {field, queue, hold: end.hold, before: {hold, bag: bagLeft, pieces: stream.slice(0, stream.length - queue.length)}}
}

// FNV-1a, so each part gets its own seed from its name.
function seedOf(name: string): number {
    let hash = 2166136261
    for (const ch of name) hash = Math.imul(hash ^ ch.charCodeAt(0), 16777619)
    return hash >>> 0
}

// What a part makes its puzzles with. Its random numbers are its own, so
// remaking one part leaves the others as they are.
function bench(name: string, log: (text: string) => void) {
    const random = mulberry(seedOf(name))
    const made: Made[] = []
    const targets: Record<string, string[]> = {}
    const seen = new Set<string>()

    const add = (item: Made): boolean => {
        const key = `${item.category}|${encode(item.field)}|${item.queue.join('')}|${item.hold ?? ''}`
        if (seen.has(key)) return false
        seen.add(key)
        made.push(item)
        return true
    }

    const goalFor = (goal: string, key?: string, after?: string[]): Goal => goalOf({id: '', category: '', goal, board: '', queue: '', hold: '', targets: key, after}, targets)

    // Keeps drawing contexts until `want` puzzles solve or the tries run out.
    const fill = (want: number, tries: number, make: () => Made | null) => {
        let count = 0
        for (let i = 0; i < tries && count < want; i++) {
            const item = make()
            if (!item) continue
            if (!solvable(goalFor(item.goal, item.targets, item.after), turnFrom(item.field.rows, item.queue, item.hold))) continue
            if (add(item)) count++
        }
        return count
    }

    return {name, random, made, targets, log, add, goalFor, fill}
}

type Bench = ReturnType<typeof bench>

const group = (kind: Diagram['kind'], path?: string) => DIAGRAMS.filter(d => d.kind === kind && (!path || d.path === path))
const withMirrors = (boards: string[]) => [...new Set(boards.flatMap(board => [board, mirror(board)]))]
const fresh: Before = {hold: null, bag: 0, pieces: []}

// PCO, first PC: build the opener from the first bag, or finish it with
// whatever the first bag left plus the second.
function pc1({random, targets, fill, log}: Bench) {
    const pco = withMirrors(group('pco').map(d => d.board))
    targets.pco = pco
    const source = group('pco')[0].source
    log(`build ${fill(24, 200, () => ({category: 'pco/pc1/build', goal: 'build', field: emptyField(), queue: bag(random), hold: null, targets: 'pco', source, before: fresh}))}`)
    log(`finish ${fill(32, 300, () => {
        const state = dealt(emptyField(), pick(random, pco), [...bag(random), ...bag(random)], null, 0)
        return state && {category: 'pco/pc1/finish', goal: 'pc', ...state, source}
    })}`)
}

// PCO, second PC: the first PC leaves four pieces of the second bag, which
// build this setup. Then the third bag finishes it.
function pc2({random, targets, fill, log}: Bench) {
    // Leftovers from one bag are four different pieces.
    const pc2 = group('pc2').filter(d => new Set(piecesIn(d.board)).size === 4)
    targets.pc2 = withMirrors(pc2.map(d => d.board))
    const leftovers = (board: string) => {
        const left = shuffle(random, piecesIn(board))
        const held = random() < 0.4 ? left.shift()! : null
        return {left, held}
    }
    log(`build ${fill(24, 300, () => {
        const {left, held} = leftovers(pick(random, targets.pc2))
        return {category: 'pco/pc2/build', goal: 'build', field: emptyField(), queue: [...left, ...bag(random)], hold: held, targets: 'pc2', source: pc2[0].source, before: {hold: held, bag: left.length, pieces: []}}
    })}`)
    log(`finish ${fill(32, 300, () => {
        const board = pick(random, targets.pc2)
        const {left, held} = leftovers(board)
        const state = dealt(emptyField(), board, [...left, ...bag(random)], held, left.length)
        return state && {category: 'pco/pc2/finish', goal: 'pc', ...state, source: pc2[0].source}
    })}`)
}

// DPC, for the leftover piece the part is named after: the leftover in hold
// and a fresh bag build the setup. Then a TSD, and the next bag finishes the
// perfect clear. The setup to build depends on the order of that bag, so each
// one has its own puzzles, with bags in its order. S and J setups mirror into
// Z and L ones.
function dpc({name, random, targets, fill, log}: Bench) {
    const flipOrder = (order: string) => order.replace(/[JLSZ]/g, piece => SWAP[piece])
    const inOrder = (queue: Piece[], order: string) => order.split(',').filter(Boolean).every(pair => queue.indexOf(pair[0] as Piece) < queue.indexOf(pair[2] as Piece))
    const paths = new Set(group('dpc').map(d => d.path).filter(path => path === name || path.startsWith(`${name}/`)))
    for (const path of paths) {
        const own = group('dpc', path)
        const {extra, order = '', mirrored, source} = own[0]
        const boards = own.map(d => d.board)
        const flipped = {boards: boards.map(mirror), order: flipOrder(order)}
        const leaves = ['S', 'J'].includes(extra!)
            ? [
                {path, extra, ways: [{boards, order}]},
                {path: path.replace(/[^/]*$/, id => id.replace(/[jlsz]/g, c => SWAP[c.toUpperCase()].toLowerCase())), extra: SWAP[extra!], ways: [flipped]},
            ]
            : [{path, extra, ways: mirrored ? [{boards, order}, flipped] : [{boards, order}]}]
        for (const leaf of leaves) {
            const hold = leaf.extra as Piece
            targets[leaf.path] = leaf.ways.flatMap(way => way.boards)
            // A way to build it, and a bag in its order.
            const deal = () => {
                const way = pick(random, leaf.ways)
                for (;;) {
                    const queue = bag(random)
                    if (inOrder(queue, way.order)) return {way, queue}
                }
            }
            const want = leaf.path === 'dpc/extra-t' ? 16 : 8
            log(`${leaf.path} build ${fill(want, 200, () => ({category: `${leaf.path}/build`, goal: 'build', field: emptyField(), queue: deal().queue, hold, targets: leaf.path, source, before: {hold, bag: 0, pieces: []}}))}`)
            log(`${leaf.path} finish ${fill(want, 200, () => {
                const {way, queue} = deal()
                const state = dealt(emptyField(), pick(random, way.boards), [...queue, ...bag(random)], hold, 0)
                return state && {category: `${leaf.path}/finish`, goal: 'tsd pc', ...state, source}
            })}`)
        }
    }
}

// Single Double PC: bag 1 builds a TSS, bag 2 a TSD, and bag 3 clears. Each
// stage uses its whole bag, so the next one starts on a fresh bag.
function sdpc({random, targets, fill, log}: Bench) {
    for (const flip of [false, true]) {
        const turn = (text: string) => flip ? mirror(text) : text
        const tss = group('sdpc-tss')[0]
        const tsd = group('sdpc-tsd')[0]
        const pc = group('sdpc-pc')[0]
        targets['sdpc-tss'] = withMirrors([tss.board])
        // The TSD diagram draws the TSS residue in gray. Put its colors back.
        // Both are bottom-aligned, so cells line up.
        const setup = fieldOf(tsd.board)
        for (const [cell, color] of fieldOf(tsd.base!).colors) setup.colors.set(cell, color)
        targets['sdpc-tsd'] = withMirrors([encode(setup)])
        // Each spin has to leave the residue the next bag builds on.
        const tssAfter = withMirrors([tsd.base!])
        const tsdAfter = withMirrors([pc.board])
        log(`tss ${fill(8, 100, () => ({category: 'sdpc/tss', goal: 'build tss clean', field: emptyField(), queue: bag(random), hold: null, targets: 'sdpc-tss', after: tssAfter, source: tss.source, before: fresh}))}`)
        log(`tsd ${fill(8, 100, () => ({category: 'sdpc/tsd', goal: 'build tsd clean', field: fieldOf(turn(tsd.base!)), queue: bag(random), hold: null, targets: 'sdpc-tsd', after: tsdAfter, source: tsd.source, before: fresh}))}`)
        log(`pc ${fill(8, 100, () => ({category: 'sdpc/pc', goal: 'pc', field: fieldOf(turn(pc.board)), queue: bag(random), hold: null, source: pc.source, before: fresh}))}`)
    }
}

// Mountainous Stacking 2: bag 1 builds the opener with the L held. Bag 2
// builds one of the setups and spins a TST in the marked spot, leaving the
// board bag 3 needs. Bag 3 does a TSD and a perfect clear.
function ms2({random, targets, fill, log}: Bench) {
    const opener = group('ms2-opener')[0]
    targets.ms2 = withMirrors([opener.board])
    log(`bag1 ${fill(16, 100, () => ({category: 'ms2/bag1', goal: 'build', field: emptyField(), queue: bag(random), hold: null, targets: 'ms2', source: opener.source, before: fresh}))}`)
    for (const setup of group('ms2-setup')) {
        const id = setup.path.split('/')[2]
        for (const flip of [false, true]) {
            const turn = (text: string) => flip ? mirror(text) : text
            const pin = flip ? mirrorCells(setup.spins![0]) : setup.spins![0]
            const board = turn(setup.board)
            const key = `ms2-${id}-${flip ? 'm' : 'r'}`
            targets[key] = [board]
            const rows = rowsOf(boardOf(board))
            const spot = placements(rows, 'T', TUCK).find(item => cellsOf('T', item.rot, item.x, item.y).join('.') === pin)!
            const residue = place(fieldOf(board), spot).field
            const after = [encode(residue)]
            log(`bag2 ${id}${flip ? ' mirrored' : ''} ${fill(4, 200, () => {
                const state = dealt(emptyField(), turn(opener.board), [...bag(random), ...bag(random)], null, 0)
                return state && {category: `ms2/bag2/${id}`, goal: `build tst@${pin} clean`, ...state, targets: key, after, source: setup.source}
            })}`)
            // A piece the setup kept in hold goes into bag 3.
            const held = (setup.extra ? (flip ? SWAP[setup.extra] ?? setup.extra : setup.extra) : null) as Piece | null
            log(`bag3 ${id}${flip ? ' mirrored' : ''} ${fill(3, 100, () => ({category: 'ms2/bag3', goal: 'tsd pc', field: residue, queue: bag(random), hold: held, source: setup.source, before: {hold: held, bag: 0, pieces: []}}))}`)
        }
    }
}

// Mid-game technique puzzles on generated stacks (see techniques.ts).
const technique = (category: string, scale = 1) => ({random, add, log}: Bench) => {
    for (const item of techniquePuzzles(random, log, category, scale)) {
        add({category: item.category, goal: item.goal, field: item.field, queue: item.queue, hold: null, after: item.after, source: item.source, note: item.note})
    }
}

// Height differences over a well in this column.
const height = (well: number) => ({random, add, log}: Bench) => {
    for (const item of heightPuzzles(random, log, [well], {1: 5, 2: 5, 3: 4})) {
        add({category: item.category, goal: item.goal, field: item.field, queue: item.queue, hold: null, after: item.after, note: item.note})
    }
}

// General T-spins on generated stacks.
const general = (kind: Spin, want: number) => ({random, add, log}: Bench) => {
    let count = 0
    for (let tries = 0; count < want && tries < want * 80; tries++) {
        let batch = stackedTspin(random, kind)
        if (kind === 'tst' || random() < 0.4) {
            const one = designedTspin(random, kind)
            batch = one ? [one] : []
        }
        for (const item of batch) {
            if (count >= want) break
            const start = turnFrom(item.field.rows, item.queue, null)
            if (looseness(spinGoal(kind), start) > 0.4) continue
            const after = ideal(spinGoal(kind), start)
            if (after && add({category: `${kind}/general`, goal: `${kind} clean`, field: item.field, queue: item.queue, hold: null, after})) count++
        }
    }
    log(`${count}`)
}

type Part = {name: string; block: number; make: (bench: Bench) => void}

// The bank, in parts made on their own (see run.mjs). Each part's puzzles are
// numbered from block * 100, so ids stay put when other parts are remade. A
// new part gets a new block. Slow ones are split to run side by side.
export const PARTS: Part[] = [
    {name: 'pco/pc1', block: 1, make: pc1},
    {name: 'pco/pc2', block: 2, make: pc2},
    {name: 'dpc/extra-o', block: 3, make: dpc},
    {name: 'dpc/extra-i', block: 4, make: dpc},
    {name: 'dpc/extra-sz', block: 5, make: dpc},
    {name: 'dpc/extra-jl', block: 6, make: dpc},
    {name: 'dpc/extra-t', block: 7, make: dpc},
    {name: 'sdpc', block: 8, make: sdpc},
    {name: 'ms2', block: 9, make: ms2},
    {name: 'tsd/kaidan', block: 10, make: technique('tsd/kaidan')},
    {name: 'tsd/donation', block: 11, make: technique('tsd/donation')},
    {name: 'tsd/fractal', block: 12, make: technique('tsd/fractal')},
    {name: 'tsd/stsd/a', block: 13, make: technique('tsd/stsd', 0.5)},
    {name: 'tsd/stsd/b', block: 14, make: technique('tsd/stsd', 0.5)},
    {name: 'tst/methods', block: 15, make: technique('tst/methods')},
    ...[2, 3, 4, 5, 6, 7].map((well, i): Part => ({name: `height/well${well}`, block: 16 + i, make: height(well)})),
    {name: 'tsd/general/a', block: 22, make: general('tsd', 30)},
    {name: 'tsd/general/b', block: 23, make: general('tsd', 30)},
    {name: 'tst/general', block: 24, make: general('tst', 30)},
    {name: 'tss/general', block: 25, make: general('tss', 30)},
]

// Where a part's file goes under bank/.
export const fileOf = (name: string) => `${name.replace(/\//g, '-')}.ts`

const line = (value: object) => JSON.stringify(value).replace(/"(\w+)":/g, '$1: ').replace(/"/g, '\'').replace(/,(\w)/g, ', $1')

// Makes one part, as the text of its file.
export function makePart(name: string, log: (text: string) => void): string {
    const part = PARTS.find(item => item.name === name)
    if (!part) throw new Error(`no part ${name}`)
    const made = bench(name, log)
    part.make(made)
    if (made.made.length >= 100) throw new Error(`${name} made ${made.made.length} puzzles, more than block ${part.block} holds`)
    const puzzles = made.made.map((item, i): Puzzle => {
        const puzzle: Puzzle = {
            id: String(part.block * 100 + i + 1),
            category: item.category,
            goal: item.goal,
            board: encode(item.field),
            queue: item.queue.join(''),
            hold: item.hold ?? '',
        }
        // The board the build's reference solution makes, to show the player.
        if (item.targets) {
            puzzle.targets = item.targets
            const steps = createSolver(made.goalFor(item.goal, item.targets, item.after), TUCK).solve(turnFrom(item.field.rows, item.queue, item.hold))!
            let field = item.field
            for (const step of steps) {
                field = place(field, step.placement).field
                if (step.after.stage > 0) break
            }
            puzzle.target = encode(field)
        }
        if (item.after) puzzle.after = item.after
        if (item.source) puzzle.source = item.source
        if (item.note) puzzle.note = item.note
        if (item.before) puzzle.before = {hold: item.before.hold ?? '', bag: item.before.bag, pieces: item.before.pieces.join('')}
        return puzzle
    })
    for (const puzzle of puzzles) {
        const legal = puzzle.before
            ? bagLegal(pieces(puzzle.before.pieces + puzzle.queue), puzzle.before.bag)
            : bagLegal(pieces(puzzle.queue))
        if (!legal) throw new Error(`#${puzzle.id} ${puzzle.category}: queue ${puzzle.queue} can't come from a 7-bag`)
    }
    return `// Generated by generate.ts, part '${name}'. Don't edit by hand.

import type {Puzzle} from '../puzzles.ts'

export const TARGETS: Record<string, string[]> = {
${Object.entries(made.targets).map(([key, boards]) => `    '${key}': [\n${boards.map(board => `        '${board}',`).join('\n')}\n    ],`).join('\n')}
}

export const PUZZLES: Puzzle[] = [
${puzzles.map(puzzle => `    ${line(puzzle)},`).join('\n')}
]
`
}

// bank.ts: every part together.
export function indexFile(): string {
    return `// Generated by generate.ts. Don't edit by hand. Each part is a file under
// bank/, made on its own by run.mjs.

import type {Puzzle} from './puzzles.ts'
${PARTS.map(part => `import * as part${part.block} from './bank/${fileOf(part.name)}'`).join('\n')}

const PARTS = [${PARTS.map(part => `part${part.block}`).join(', ')}]

export const TARGETS: Record<string, string[]> = Object.assign({}, ...PARTS.map(part => part.TARGETS))

export const PUZZLES: Puzzle[] = PARTS.flatMap(part => part.PUZZLES)
`
}
