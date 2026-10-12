// Checks for the trainer, run side by side by run.mjs:
//
//   pnpm tetris-test [category...]

import {
    createGame,
    hardDrop,
    hold,
    rotate,
    shift,
    softStep,
    sonicDrop,
    undo,
    HEIGHT,
    SPAWN_X,
    WIDTH,
    type Game,
    type KickTable,
    type Lock,
} from './engine.ts'
import {createInput, pressHorizontal, tickInput, type Handling} from './handling.ts'
import {kickTests} from './kicks.ts'
import {cells, PIECES, type Piece, type Rot} from './pieces.ts'
import {PUZZLES, TARGETS} from './bank.ts'
import {leaves} from './categories.ts'
import {choose, record, restore, type Progress} from './progress.ts'
import {bagLegal, boardOf, goalOf, pieces, setupOf, turnOf, type Puzzle} from './puzzles.ts'
import {DEFAULT_SETTINGS, normalizeSettings} from './settings.ts'
import {createSolver, pathTo, placements, progress, rowsOf, WASTED, type Goal, type Move, type Options, type Step} from './solver.ts'

function assert(cond: unknown, message: string): asserts cond {
    if (!cond) throw new Error(message)
}

const RUN: Record<Move, (game: Game) => boolean> = {
    L: game => shift(game, -1),
    R: game => shift(game, 1),
    D: softStep,
    S: sonicDrop,
    CW: game => rotate(game, 1),
    CCW: game => rotate(game, -1),
    '180': game => rotate(game, 2),
}

// Plays solver steps through the real engine. With a goal, also tracks how
// many of its steps the locks complete.
function replay(game: Game, steps: Step[], options: Options, goal: Goal = []): Lock[] & {stage?: number} {
    const locks: Lock[] & {stage?: number} = []
    locks.stage = 0
    for (const step of steps) {
        if (step.hold) assert(hold(game), 'replay hold')
        const path = pathTo(rowsOf(game.board), step.placement, options)
        assert(path, `no path to ${JSON.stringify(step.placement)}`)
        for (const move of path) assert(RUN[move](game), `replay ${move}`)
        const a = game.active!
        const want = step.placement
        assert(a.piece === want.piece && a.rot === want.rot && a.x === want.x && a.y === want.y, 'replay ended somewhere else')
        const lock = hardDrop(game)
        assert(lock, 'replay lock')
        assert(lock.spin === want.spin, `spin ${lock.spin} but solver said ${want.spin}`)
        locks.stage = progress(goal, locks.stage!, lock, rowsOf(game.board))
        locks.push(lock)
    }
    return locks
}

function mulberry(seed: number) {
    return () => {
        seed = seed + 0x6d2b79f5 | 0
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
        return ((t ^ t >>> 14) >>> 0) / 4294967296
    }
}

// The engine's own idea of where a piece can rest, found with its own moves.
function engineSpots(board: Uint8Array, piece: Piece, kick: KickTable): Set<string> {
    const start = createGame({board, queue: [piece], hold: null}, kick)
    const key = (game: Game) => `${game.active!.rot},${game.active!.x},${game.active!.y}`
    const seen = new Set([key(start)])
    const queue = [{rot: start.active!.rot, x: start.active!.x, y: start.active!.y}]
    const spots = new Set<string>()
    const at = (s: {rot: Rot; x: number; y: number}) => {
        const game = createGame({board, queue: [piece], hold: null}, kick)
        Object.assign(game.active!, s)
        return game
    }
    for (let i = 0; i < queue.length; i++) {
        const s = queue[i]
        for (const move of ['L', 'R', 'D', 'CW', 'CCW', '180'] as Move[]) {
            const game = at(s)
            if (!RUN[move](game)) continue
            const k = key(game)
            if (seen.has(k)) continue
            seen.add(k)
            queue.push({rot: game.active!.rot, x: game.active!.x, y: game.active!.y})
        }
        const game = at(s)
        if (!softStep(game)) {
            spots.add(cells(piece, s.rot).map(([dx, dy]) => (s.y + dy) * WIDTH + s.x + dx).sort((a, b) => a - b).join())
        }
    }
    return spots
}

// Checks of the parts underneath the puzzles. Throws on the first failure.
export function unitTests() {
    const srs = kickTests('SRS', 'I', 0, 1)
    const plus = kickTests('SRS+', 'I', 0, 1)
    assert(srs[1][0] === -2, 'guideline I second kick')
    assert(plus[1][0] === 1, 'SRS+ I second kick')
    assert(kickTests('SRS+', 'T', 0, 2).length === 6, 'T 180 kicks')

    // A T dropped flat is no spin. A TSD slot gives a full spin and two lines.
    const flat = createGame({board: boardOf('GGGGGGGGG.'), queue: ['T'], hold: null}, 'SRS+')
    const flatLock = hardDrop(flat)
    assert(flatLock?.spin === 'none' && flatLock.lines === 0, 'flat T')
    const slot = boardOf(['GG........', 'G...GGGGGG', 'GG.GGGGGGG'].join('/'))
    const tsd = createSolver([{kind: 'tspin', lines: 2}], {kick: 'SRS+', moves: 'tuck'})
    const tsdTurn = {rows: rowsOf(slot), active: 'T' as Piece, queue: [], hold: null, canHold: true, stage: 0}
    const tsdSteps = tsd.solve(tsdTurn)
    assert(tsdSteps?.length === 1, 'TSD found')
    const tsdLock = replay(createGame({board: slot, queue: ['T'], hold: null}, 'SRS+'), tsdSteps, {kick: 'SRS+', moves: 'tuck'})[0]
    assert(tsdLock.spin === 'full' && tsdLock.lines === 2, 'TSD in the engine')

    // Hard drops never spin, and undo restores the turn.
    const game = createGame({board: slot, queue: ['O', 'T'], hold: null}, 'SRS+')
    const current = () => game.active?.piece
    hardDrop(game)
    assert(current() === 'T', 'next piece')
    assert(undo(game) && current() === 'O', 'undo')
    assert(hold(game) && current() === 'T' && game.hold === 'O', 'hold')
    assert(!hold(game), 'one hold per piece')

    // Handling: ARR 0 slides to the wall once DAS charges.
    const open = createGame({board: boardOf(''), queue: ['T'], hold: null}, 'SRS+')
    const input = createInput(open.generation)
    const handling: Handling = {das: 80, arr: 0, dcd: 0, sdf: null, cancelDas: false}
    pressHorizontal(input, -1, open, handling)
    assert(open.active?.x === SPAWN_X - 1, 'first tap moves one')
    tickInput(input, open, handling, 80)
    assert(open.active?.x === 0, 'ARR 0 reaches the wall')

    // The solver and the engine agree on every resting spot, path, and spin.
    const random = mulberry(1)
    for (let trial = 0; trial < 60; trial++) {
        const rows: string[] = []
        const height = 2 + Math.floor(random() * 6)
        for (let r = 0; r < height; r++) {
            let row = ''
            for (let x = 0; x < WIDTH; x++) row += random() < 0.25 + r * 0.1 ? 'G' : '.'
            rows.push(row)
        }
        const board = boardOf(rows.join('/'))
        for (const piece of PIECES) {
            for (const kick of ['SRS+', 'SRS'] as const) {
                const options: Options = {kick, moves: 'full'}
                const spots = placements(rowsOf(board), piece, options)
                const fromSolver = new Set(spots.map(s => cells(piece, s.rot).map(([dx, dy]) => (s.y + dy) * WIDTH + s.x + dx).sort((a, b) => a - b).join()))
                const fromEngine = [...engineSpots(board, piece, kick)].filter(spot => spot.split(',').every(cell => Number(cell) >= 0))
                for (const spot of fromEngine) assert(fromSolver.has(spot), `solver missed ${piece} ${spot} (${kick})`)
                assert(fromSolver.size === fromEngine.length, `solver found extra ${piece} spots`)
                for (const spot of spots) {
                    const sim = createGame({board, queue: [piece], hold: null}, kick)
                    replay(sim, [{hold: false, placement: spot, lines: 0, after: null!, done: false}], options)
                }
            }
        }
    }

    // Settings load and clean up.
    const normalized = normalizeSettings({
        kick: 'SRS',
        handling: {das: 9999, arr: -4, sdf: 41, cancelDas: true},
        binds: {moveLeft: ['KeyQ', 'KeyQ', 'ArrowLeft'], hardDrop: ['KeyQ'], hold: ['KeyH']},
    })
    assert(normalized.kick === 'SRS', 'kick loads')
    assert(normalized.handling.das === 333 && normalized.handling.arr === 0, 'handling clamps')
    assert(normalized.handling.sdf == null, 'sdf 41 is instant')
    assert(normalized.binds.moveLeft.join() === 'KeyQ,ArrowLeft', 'binds dedupe')
    assert(!normalized.binds.hardDrop.includes('KeyQ'), 'a key binds once')
    assert(normalized.binds.hold.includes('KeyH') && !normalized.binds.hint.includes('KeyH'), 'stored keys beat new defaults')
    assert(DEFAULT_SETTINGS.kick === 'SRS+', 'default kick')

    // T-spin goals need the exact line count. Any other T is wasted.
    const empty = new Uint16Array(HEIGHT)
    const spin = (lines: number) => ({piece: 'T' as Piece, rot: 2 as Rot, x: 3, y: 17, spin: 'full' as const, lines})
    assert(progress([{kind: 'tspin', lines: 1}], 0, spin(2), empty) === WASTED, 'a TSD is not a TSS')
    assert(progress([{kind: 'tspin', lines: 2}], 0, spin(3), empty) === WASTED, 'a TST is not a TSD')
    assert(progress([{kind: 'tspin', lines: 2}], 0, {...spin(0), spin: 'none'}, empty) === WASTED, 'a T dropped flat is wasted')
    assert(progress([{kind: 'tspin', lines: 2}], 0, {...spin(0), piece: 'O', spin: 'none'}, empty) === 0, 'other pieces build')
    assert(progress([{kind: 'shape', targets: [empty]}, {kind: 'tspin', lines: 2}], 0, {...spin(0), spin: 'none'}, new Uint16Array(HEIGHT).fill(1)) === 0, 'Ts can build a setup')
    assert(progress([{kind: 'tspin', lines: 2}, {kind: 'pc'}], 0, spin(2), empty) === 2, 'TSD that perfect clears')
    assert(progress([{kind: 'tspin', lines: 2, at: [181, 182, 183, 192]}], 0, spin(2), empty) === WASTED, 'a TSD in the wrong spot')
    assert(progress([{kind: 'tspin', lines: 2, at: [183, 184, 185, 194]}], 0, spin(2), empty) === 1, 'a TSD in the pinned spot')
    assert(progress([{kind: 'tspin', lines: 2, column: 5}], 0, spin(2), empty) === WASTED, 'a TSD beside the well')
    assert(progress([{kind: 'tspin', lines: 2, column: 4}], 0, spin(2), empty) === 1, 'a TSD over the well')

    // 7-bag legality.
    assert(bagLegal(pieces('IJLOSTZ')) && bagLegal(pieces('TIJ' + 'IJLOSTZ')), 'legal runs')
    assert(!bagLegal(pieces('LLLT')) && !bagLegal(pieces('IJLOSTI'), 0), 'illegal runs')
    assert(bagLegal(pieces('SZJ' + 'ZSOILTJ'), 3) && !bagLegal(pieces('SZJ' + 'ZSOILTJ'), 0), 'offsets')

    // Practice picks only enabled categories and avoids the last few.
    const start: Progress = {enabled: ['tsd/general'], seen: leaves(), results: [], streak: 0}
    const sample = PUZZLES.find(puzzle => puzzle.category === 'tsd/general')!
    const after = record(start, sample.id, true, true)
    assert(after.streak === 1 && after.results.length === 1, 'record')
    for (let i = 0; i < 20; i++) {
        const pick = choose(PUZZLES, after)!
        assert(pick.category === 'tsd/general' && pick.id !== sample.id, 'choose')
    }
    assert(choose(PUZZLES, {...start, enabled: []}) === null, 'nothing enabled')

    // Saves pick up new leaves on, and split leaves as they were.
    const old = ['tsd/general', 'dpc/extra-o/build', 'dpc/extra-o/finish', 'dpc/extra-i/build', 'dpc/extra-t/build']
    const restored = new Set(restore({enabled: ['tsd/general', 'dpc/extra-o/build'], seen: old, results: [], streak: 0}).enabled)
    assert(restored.has('dpc/extra-o/jo/build') && restored.has('dpc/extra-o/other/build'), 'split leaves keep an enabled leaf on')
    assert(!restored.has('dpc/extra-o/jo/finish') && !restored.has('dpc/extra-i/li/build'), 'split leaves keep a disabled leaf off')
    assert(!restored.has('dpc/extra-t/build') && restored.has('height/1') && restored.has('tsd/kaidan'), 'new leaves start on')

    // Every target to build is free of full rows, so building one never clears.
    for (const boards of Object.values(TARGETS)) {
        for (const board of boards) assert(board.split('/').every(row => row.includes('.')), `target with a full row: ${board}`)
    }

    const ids = new Set<string>()
    for (const puzzle of PUZZLES) {
        assert(!ids.has(puzzle.id), `duplicate id ${puzzle.id}`)
        ids.add(puzzle.id)
    }
}

// Checks these puzzles in the bank: well formed, solvable both ways, the
// solution works in the engine, and hard dropping everything doesn't win.
// Returns what failed.
export function checkPuzzles(ids: string[]): string[] {
    const failures: string[] = []
    for (const id of ids) {
        try {
            checkPuzzle(PUZZLES.find(puzzle => puzzle.id === id)!)
        } catch (error) {
            failures.push(`${id}: ${(error as Error).message}`)
        }
    }
    return failures
}

// Openers and perfect clears: the queue continues the bags the setup was
// dealt from, and the setup on the board can be built from exactly those
// pieces, leaving this hold and this queue.
function checkHistory(puzzle: Puzzle) {
    const before = puzzle.before!
    const dealt = pieces(before.pieces)
    assert(bagLegal([...dealt, ...pieces(puzzle.queue)], before.bag), `queue doesn't continue the bag (${before.pieces}|${puzzle.queue})`)
    if (!dealt.length) {
        assert((before.hold || '') === puzzle.hold, 'hold changed with nothing dealt')
        return
    }
    // Every piece dealt is on the board or in hold.
    const count = (list: string[]) => list.slice().sort().join('')
    const placed = [...'IJLOSTZ'].flatMap(piece => Array(puzzle.board.split(piece).length - 1 >> 2).fill(piece))
    assert(count([...before.hold, ...before.pieces]) === count([...placed, ...puzzle.hold]), 'pieces dealt do not match the board and hold')
    const board = rowsOf(boardOf(puzzle.board))
    const solver = createSolver([{kind: 'shape', targets: [board]}], {kick: 'SRS+', moves: 'full'})
    const want = `${puzzle.queue}|${puzzle.hold}`
    const stream = [...dealt, ...pieces(puzzle.queue)]
    const start = {rows: new Uint16Array(HEIGHT), active: stream[0], queue: stream.slice(1), hold: pieces(before.hold)[0] ?? null, canHold: true, stage: 0}
    const seen = new Set<string>()
    const reach = (turn: typeof start): boolean => {
        for (const step of solver.steps(turn)) {
            const after = step.after
            if (step.done) {
                if (`${after.active ?? ''}${after.queue.join('')}|${after.hold ?? ''}` === want) return true
                continue
            }
            const key = `${String.fromCharCode(...after.rows)}|${after.active}|${after.queue.length}|${after.hold}`
            if (seen.has(key) || !solver.solvable(after)) continue
            seen.add(key)
            if (reach(after as typeof start)) return true
        }
        return false
    }
    assert(reach(start), 'the setup cannot be built from the pieces dealt')
}

function checkPuzzle(puzzle: Puzzle) {
    const setup = setupOf(puzzle)
    const goal = goalOf(puzzle, TARGETS)
    assert(leaves().includes(puzzle.category), `unknown category ${puzzle.category}`)
    assert(puzzle.board === '' || puzzle.board.split('/').every(row => row.length === WIDTH), 'row width')
    assert(puzzle.board.split('/').length < HEIGHT - 4, 'stack height')
    assert(bagLegal(pieces(puzzle.queue)), 'queue could not come from a 7-bag')
    if (puzzle.before) checkHistory(puzzle)
    // Technique puzzles say what they teach, or why the technique isn't the
    // answer, and height differences spin over the well.
    const spins = goal.filter(objective => objective.kind === 'tspin')
    if (['tsd/kaidan', 'tsd/fractal', 'tsd/stsd', 'tsd/donation', 'tst/methods'].includes(puzzle.category) || puzzle.category.startsWith('height/')) {
        assert(puzzle.note, 'technique note')
        const want = puzzle.category === 'tsd/fractal' || puzzle.category === 'tsd/stsd' ? 2 : 1
        assert(spins.length === want && pieces(puzzle.queue).filter(piece => piece === 'T').length >= want, 'a T per spin')
    }
    if (puzzle.category.startsWith('height/')) assert(spins.every(objective => objective.kind === 'tspin' && objective.column !== undefined), 'spin over the well')
    // A T-spin has to leave the ideal board, unless a perfect clear follows.
    if (spins.length && goal[goal.length - 1].kind !== 'pc') assert(goal[goal.length - 1].kind === 'shape', 'clean finish')
    assert(goal.every(objective => objective.kind !== 'shape' || objective.targets.length), 'targets')
    for (const kick of ['SRS+', 'SRS'] as const) {
        const options: Options = {kick, moves: 'tuck'}
        const steps = createSolver(goal, options).solve(turnOf(puzzle))
        assert(steps, `unsolvable with ${kick}`)
        const locks = replay(createGame(setup, kick), steps, options, goal)
        assert(locks.stage === goal.length, `${kick} replay misses the goal`)
    }
    const brainless = createGame(setup, 'SRS+')
    let stage = 0
    while (brainless.active && stage < goal.length) {
        const lock = hardDrop(brainless)!
        stage = progress(goal, stage, lock, rowsOf(brainless.board))
    }
    assert(stage < goal.length, 'hard dropping everything solves it')
}
