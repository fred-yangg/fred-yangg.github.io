import {CELL, GARBAGE, HEIGHT, WIDTH, type Setup} from './engine.ts'
import {PIECES, type Piece} from './pieces.ts'
import {rowsOf, type Goal, type Objective, type Turn} from './solver.ts'

export type Step = 'tss' | 'tsd' | 'tst' | 'pc' | 'build' | 'clean'

// board: the bottom rows of the field, top first, joined by '/'.
// Cells are '.', a piece letter, or 'G' for garbage.
// queue: the first piece is the one in play.
// goal: steps done in order, separated by spaces, like 'tsd pc'. A T-spin
//   step can name the cells its T has to lock in: 'tsd@164.173.174.175',
//   or the column its middle cell has to lock in: 'tsd@col4'.
// targets: for 'build', a key into the bank's targets. Any of them counts.
// target: the board the reference solution builds, to show the player.
// after: for 'clean', the ideal boards to finish on. The T-spin alone isn't
//   enough: the board it leaves has to be one of these.
// note: for technique puzzles, what the ideal finish teaches, or why the
//   technique isn't the answer here.
// before: for openers and perfect clears, where the stage began: the hold,
//   how many pieces were left in that bag, and the pieces dealt since. The
//   board was built from exactly those pieces, so the queue continues real bags.
export type Puzzle = {
    id: string
    category: string
    goal: string
    board: string
    queue: string
    hold: string
    targets?: string
    target?: string
    after?: string[]
    source?: string
    note?: string
    before?: {hold: string; bag: number; pieces: string}
}

export const STEP_SHORT: Record<Step, string> = {
    tss: 'TSS',
    tsd: 'TSD',
    tst: 'TST',
    pc: 'PC',
    build: 'Build',
    clean: 'Clean',
}

export const STEP_NAME: Record<Step, string> = {
    tss: 'T-Spin Single',
    tsd: 'T-Spin Double',
    tst: 'T-Spin Triple',
    pc: 'Perfect Clear',
    build: 'Build the setup',
    clean: 'Clean finish',
}

const STEP_TEXT: Record<Step, string> = {
    tss: 'clear exactly one line with a T-spin (minis don’t count)',
    tsd: 'clear exactly two lines with one T-spin',
    tst: 'clear three lines with one T-spin',
    pc: 'clear every cell on the board',
    build: 'match the target below exactly',
    clean: 'leave the ideal board behind',
}

export function stepsOf(puzzle: Puzzle): Step[] {
    return puzzle.goal.split(' ').map(token => token.split('@')[0]) as Step[]
}

// Whether the goal's T-spins have to happen in the setup's own spot.
export function pinned(puzzle: Puzzle): boolean {
    return puzzle.goal.includes('@')
}

export function goalTitle(puzzle: Puzzle): string {
    const steps = stepsOf(puzzle).filter(step => step !== 'clean')
    return steps.length === 1 ? STEP_NAME[steps[0]] : steps.map(step => STEP_SHORT[step]).join(' → ')
}

export function goalText(puzzle: Puzzle): string {
    const text = stepsOf(puzzle).map(step => STEP_TEXT[step]).join(', then ')
    const spot = puzzle.goal.includes('@col') ? ' The T has to go in the well.' : pinned(puzzle) ? ' The T has to go in the setup’s own slot.' : ''
    return `${text[0].toUpperCase()}${text.slice(1)}.${spot}`
}

export function pieces(text: string): Piece[] {
    return [...text].filter((ch): ch is Piece => (PIECES as readonly string[]).includes(ch))
}

export function boardOf(text: string): Uint8Array {
    const board = new Uint8Array(WIDTH * HEIGHT)
    const rows = text ? text.split('/') : []
    const top = HEIGHT - rows.length
    rows.forEach((row, r) => {
        for (let x = 0; x < WIDTH; x++) {
            const ch = row[x]
            board[(top + r) * WIDTH + x] = ch === 'G' ? GARBAGE : ch in CELL ? CELL[ch as Piece] : 0
        }
    })
    return board
}

export function goalOf(puzzle: Puzzle, targets: Record<string, string[]>): Goal {
    return puzzle.goal.split(' ').map((token): Objective => {
        const [step, at] = token.split('@') as [Step, string?]
        if (step === 'pc') return {kind: 'pc'}
        if (step === 'build') return {kind: 'shape', targets: (targets[puzzle.targets ?? ''] ?? []).map(text => rowsOf(boardOf(text)))}
        if (step === 'clean') return {kind: 'shape', targets: (puzzle.after ?? []).map(text => rowsOf(boardOf(text)))}
        const lines = step === 'tss' ? 1 : step === 'tsd' ? 2 : 3
        if (at?.startsWith('col')) return {kind: 'tspin', lines, column: Number(at.slice(3))}
        return at ? {kind: 'tspin', lines, at: at.split('.').map(Number)} : {kind: 'tspin', lines}
    })
}

export function setupOf(puzzle: Puzzle): Setup {
    return {
        board: boardOf(puzzle.board),
        queue: pieces(puzzle.queue),
        hold: pieces(puzzle.hold)[0] ?? null,
    }
}

export function turnOf(puzzle: Puzzle): Turn {
    const setup = setupOf(puzzle)
    return {
        rows: rowsOf(setup.board),
        active: setup.queue[0] ?? null,
        queue: setup.queue.slice(1),
        hold: setup.hold,
        canHold: true,
        stage: 0,
    }
}

// Whether pieces can come out of a 7-bag randomizer in this order. offset is
// how many pieces are left in the bag before the first one, or any if unset.
export function bagLegal(sequence: Piece[], offset?: number): boolean {
    const offsets = offset === undefined ? [0, 1, 2, 3, 4, 5, 6] : [offset]
    return offsets.some(start => {
        const seen = new Set<Piece>()
        return sequence.every((piece, i) => {
            if (i >= start && (i - start) % 7 === 0) seen.clear()
            if (seen.has(piece)) return false
            seen.add(piece)
            return true
        })
    })
}
