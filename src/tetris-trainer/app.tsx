import {useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject} from 'react'

import {Board, MiniBoard, PiecePreview, type Spot} from './board.tsx'
import {Drawer, type Listening} from './drawer.tsx'
import {
    createGame,
    ghostY,
    hardDrop,
    hold,
    placedCount,
    resetTurn,
    restart,
    rotate,
    shift,
    softStep,
    sonicDrop,
    undo,
    HEIGHT,
    WIDTH,
    type Game,
    type Lock,
} from './engine.ts'
import {
    createInput,
    pressHard,
    pressHold,
    pressHorizontal,
    pressRotate,
    pressSoft,
    releaseHorizontal,
    releaseSoft,
    tickInput,
    type Input,
} from './handling.ts'
import {cells} from './pieces.ts'
import {PUZZLES, TARGETS} from './bank.ts'
import {trail} from './categories.ts'
import {choose, loadProgress, record, saveProgress, type Progress} from './progress.ts'
import {goalOf, goalText, goalTitle, setupOf, setupsText, stepsOf, STEP_NAME, STEP_SHORT, type Puzzle} from './puzzles.ts'
import {actionFor, keyLabel, loadSettings, saveSettings, ACTIONS, type Action, type Settings} from './settings.ts'
import {createChecker, type Checker} from './checker.ts'
import {pathTo, progress as advance, rowsOf, WASTED, type Goal, type Move, type Options, type Step, type Turn} from './solver.ts'
import {CategoryTree} from './tree.tsx'

type Status = 'play' | 'wrong' | 'solved' | 'showing'

type Session = {
    puzzle: Puzzle
    goal: Goal
    status: Status
    // How many goal steps are done at the start of each turn, one per game turn.
    stages: number[]
    // Used a hint or the solution.
    helped: boolean
    // Made a move that couldn't finish.
    missed: boolean
    // Added to the history yet.
    recorded: boolean
    solvedAt: number
    hint: {spot: Spot; hold: boolean} | null
    wrong: number[]
    // Bumped when the board goes back, so answers about later boards are dropped.
    epoch: number
    // Move checks still out, and when the oldest was sent.
    checking: number
    checkingSince: number
    // Waiting on a hint or the solution.
    thinking: boolean
    // The spins were done, but the board they left isn't the ideal one.
    messy: boolean
    // A T was placed without the T-spin.
    wasted: boolean
    // None of the setups the puzzle offers can be built anymore.
    unbuildable: boolean
    // A hint or solution search gave up before finding one.
    stumped: boolean
}

// Puzzle counts per category leaf, for the checklist.
const COUNTS: Record<string, number> = {}
for (const puzzle of PUZZLES) COUNTS[puzzle.category] = (COUNTS[puzzle.category] ?? 0) + 1

type Effects = {
    callout: {text: string; detail: string | null; key: number} | null
    flash: {rows: number[]; key: number} | null
    glow: {cells: number[]; key: number} | null
    shake: number
    // When the current puzzle loaded. Its goal is called out at the start.
    intro: number
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

function stageOf(session: Session, game: Game): number {
    return session.stages[game.turns.length - 1] ?? 0
}

function liveTurn(game: Game, session: Session): Turn {
    return {
        rows: rowsOf(game.board),
        active: game.active?.piece ?? null,
        queue: game.queue.slice(),
        hold: game.hold,
        canHold: !game.holdLocked,
        stage: stageOf(session, game),
    }
}

function piecesLeft(game: Game): number {
    return (game.active ? 1 : 0) + game.queue.length + (game.hold ? 1 : 0)
}

// Where the locked piece's cells ended up after any lines cleared.
function landed(lock: Lock): number[] {
    const out: number[] = []
    for (const [dx, dy] of cells(lock.piece, lock.rot)) {
        const y = lock.y + dy
        if (lock.cleared.includes(y)) continue
        out.push((y + lock.cleared.filter(row => row > y).length) * WIDTH + lock.x + dx)
    }
    return out
}

function callout(lock: Lock): {text: string; detail: string | null} | null {
    const count = ['', 'Single', 'Double', 'Triple', 'Quad'][lock.lines]
    let name: string | null = null
    if (lock.spin === 'full') name = lock.lines ? `T-Spin ${count}` : 'T-Spin'
    else if (lock.spin === 'mini') name = lock.lines ? `T-Spin Mini ${count}` : 'T-Spin Mini'
    else if (lock.lines === 4) name = 'Quad'
    if (lock.perfect) return {text: 'Perfect Clear', detail: name}
    return name ? {text: name, detail: null} : null
}

function useCellSize(ref: RefObject<HTMLDivElement | null>): number {
    const [size, setSize] = useState(28)
    useLayoutEffect(() => {
        const element = ref.current
        if (!element) return
        const measure = () => {
            const {width, height} = element.getBoundingClientRect()
            // Board plus the hold and queue columns, about 2.4 cells each.
            const fit = Math.floor(Math.min((height - 8) / HEIGHT, (width - 64) / (WIDTH + 4.8)))
            setSize(Math.max(12, Math.min(40, fit)))
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(element)
        return () => observer.disconnect()
    }, [ref])
    return size
}

export function App() {
    const [settings, setSettings] = useState<Settings>(() => loadSettings())
    const [progress, setProgress] = useState<Progress>(() => loadProgress())
    const [open, setOpen] = useState(false)
    const [listening, setListening] = useState<Listening>(null)
    const [, setFrame] = useState(0)
    const settingsRef = useRef(settings)
    const progressRef = useRef(progress)
    const openRef = useRef(open)
    const listeningRef = useRef(listening)
    const gameRef = useRef<Game | null>(null)
    const inputRef = useRef<Input | null>(null)
    const sessionRef = useRef<Session | null>(null)
    const effectsRef = useRef<Effects>({callout: null, flash: null, glow: null, shake: 0, intro: 0})
    const checkerRef = useRef<Checker | null>(null)
    const playbackRef = useRef(0)
    const heldRef = useRef(new Set<string>())
    const dispatchRef = useRef<(action: Action, pressed: boolean) => void>(() => undefined)
    const stageRef = useRef<HTMLDivElement | null>(null)
    const size = useCellSize(stageRef)

    settingsRef.current = settings
    openRef.current = open
    listeningRef.current = listening

    const refresh = () => setFrame(frame => frame + 1)

    const commitProgress = (next: Progress) => {
        progressRef.current = next
        saveProgress(next)
        setProgress(next)
    }

    const load = (puzzle: Puzzle) => {
        playbackRef.current++
        const game = createGame(setupOf(puzzle), settingsRef.current.kick)
        const input = createInput(game.generation)
        for (const code of heldRef.current) {
            const action = actionFor(settingsRef.current, code)
            if (action === 'moveLeft') pressHorizontal(input, -1, game, settingsRef.current.handling, false)
            if (action === 'moveRight') pressHorizontal(input, 1, game, settingsRef.current.handling, false)
        }
        gameRef.current = game
        inputRef.current = input
        sessionRef.current = {
            puzzle,
            goal: goalOf(puzzle, TARGETS),
            status: 'play',
            stages: [0],
            helped: false,
            missed: false,
            recorded: false,
            solvedAt: 0,
            hint: null,
            wrong: [],
            epoch: 0,
            checking: 0,
            checkingSince: 0,
            thinking: false,
            messy: false,
            wasted: false,
            unbuildable: false,
            stumped: false,
        }
        checkerRef.current?.reset()
        effectsRef.current = {callout: null, flash: null, glow: null, shake: 0, intro: Date.now()}
    }

    if (!sessionRef.current) {
        const linked = PUZZLES.find(puzzle => `#${puzzle.id}` === window.location.hash)
        load(linked ?? choose(PUZZLES, progressRef.current) ?? PUZZLES[0])
    }

    const game = gameRef.current!
    const session = sessionRef.current!
    const puzzle = session.puzzle

    useEffect(() => {
        window.history.replaceState(null, '', `#${puzzle.id}`)
    }, [puzzle.id])

    useEffect(() => {
        const follow = () => {
            const linked = PUZZLES.find(item => `#${item.id}` === window.location.hash)
            if (linked && linked.id !== sessionRef.current?.puzzle.id) {
                load(linked)
                refresh()
            }
        }
        window.addEventListener('hashchange', follow)
        return () => window.removeEventListener('hashchange', follow)
        // load and refresh only touch refs and state setters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => () => checkerRef.current?.reset(), [])

    // Asks the solver worker about the current puzzle from a given turn.
    const ask = (kind: 'check' | 'solve', turn: Turn) => {
        checkerRef.current ??= createChecker()
        const current = sessionRef.current!
        return checkerRef.current.ask({kind, key: current.puzzle.id, goal: current.goal, kick: settingsRef.current.kick, turn})
    }

    // The board went back. Answers about the old board no longer apply.
    const bump = (current: Session) => {
        current.epoch++
        current.checking = 0
        current.thinking = false
        current.stumped = false
        checkerRef.current?.reset()
    }

    // Each puzzle goes into the history once, when it's solved or left.
    const settle = (solved: boolean) => {
        const current = sessionRef.current!
        if (current.recorded) return
        current.recorded = true
        commitProgress(record(progressRef.current, current.puzzle.id, solved, solved && !current.helped && !current.missed))
    }

    // Keeps the stage list in step with the game's turns after an undo.
    const trim = (current: Session, live: Game) => {
        current.stages.length = live.turns.length
    }

    const afterLock = (lock: Lock) => {
        const current = sessionRef.current!
        const live = gameRef.current!
        const effects = effectsRef.current
        current.hint = null
        current.stumped = false
        const before = current.stages[live.turns.length - 2] ?? 0
        const stage = advance(current.goal, before, lock, rowsOf(live.board))
        current.stages.length = live.turns.length - 1
        current.stages.push(stage)
        const named = callout(lock)
        const built = stage > before && current.goal.slice(before, stage).some(objective => objective.kind === 'shape')
        if (built) effects.callout = {text: 'Setup built', detail: named?.text ?? null, key: Date.now()}
        else if (named) effects.callout = {...named, key: Date.now()}
        if (lock.cleared.length) effects.flash = {rows: lock.cleared, key: Date.now()}
        if (stage === current.goal.length) {
            live.frozen = true
            current.status = 'solved'
            current.solvedAt = performance.now()
            settle(true)
            return
        }
        if (current.status !== 'play') return
        // The check runs in the worker. Play can go on meanwhile, and a bad
        // piece found late rolls the board back to it.
        const turns = live.turns.length
        const placedCells = landed(lock)
        const epoch = current.epoch
        effects.glow = null
        if (!current.checking) current.checkingSince = performance.now()
        current.checking++
        const slow = window.setTimeout(refresh, 250)
        void ask('check', liveTurn(live, current)).then(reply => {
            window.clearTimeout(slow)
            if (sessionRef.current !== current || current.epoch !== epoch) return
            current.checking--
            if (current.status !== 'play') return refresh()
            // An unsure answer means the search gave up. Keep playing, no glow.
            if (reply.solvable) {
                if (!reply.unsure && live.turns.length === turns) effects.glow = {cells: placedCells, key: Date.now()}
                return refresh()
            }
            while (live.turns.length > turns) undo(live)
            trim(current, live)
            bump(current)
            live.frozen = true
            current.status = 'wrong'
            current.missed = true
            current.messy = stepsOf(current.puzzle)[stageOf(current, live)] === 'clean'
            current.wasted = stageOf(current, live) === WASTED
            current.unbuildable = !!current.puzzle.setups && stageOf(current, live) === 0
            current.wrong = placedCells
            effects.shake = Date.now()
            refresh()
        })
    }

    const takeBack = () => {
        const current = sessionRef.current!
        const live = gameRef.current!
        if (current.status === 'showing') return
        if (!undo(live)) resetTurn(live)
        trim(current, live)
        bump(current)
        current.status = 'play'
        current.wrong = []
        current.hint = null
        refresh()
    }

    const restartPuzzle = () => {
        const current = sessionRef.current!
        playbackRef.current++
        restart(gameRef.current!)
        trim(current, gameRef.current!)
        bump(current)
        current.status = 'play'
        current.wrong = []
        current.hint = null
        refresh()
    }

    const showHint = () => {
        const current = sessionRef.current!
        const live = gameRef.current!
        if (current.status !== 'play' || current.thinking) return
        const epoch = current.epoch
        const generation = live.generation
        current.thinking = true
        refresh()
        void ask('solve', liveTurn(live, current)).then(reply => {
            if (sessionRef.current !== current || current.epoch !== epoch) return
            current.thinking = false
            current.stumped = reply.unsure
            // Only for the piece it was asked about.
            if (reply.steps && live.generation === generation && current.status === 'play') {
                current.helped = true
                current.hint = {spot: reply.steps[0].placement, hold: reply.steps[0].hold}
            }
            refresh()
        })
    }

    const showSolution = () => {
        const current = sessionRef.current!
        const live = gameRef.current!
        if (current.status === 'showing' || current.status === 'solved' || current.thinking) return
        if (current.status === 'wrong') undo(live)
        resetTurn(live)
        trim(current, live)
        bump(current)
        current.status = 'play'
        current.wrong = []
        current.thinking = true
        const turn = liveTurn(live, current)
        const epoch = current.epoch
        const generation = live.generation
        refresh()
        void ask('solve', turn).then(reply => {
            if (sessionRef.current !== current || current.epoch !== epoch) return
            current.thinking = false
            current.stumped = reply.unsure
            if (reply.steps && live.generation === generation && current.status === 'play') playSolution(current, live, turn, reply.steps)
            refresh()
        })
    }

    const playSolution = (current: Session, live: Game, turn: Turn, steps: Step[]) => {
        current.helped = true
        current.status = 'showing'
        current.hint = null
        current.wrong = []
        const kick = settingsRef.current.kick
        const tuck: Options = {kick, moves: 'tuck'}
        const any: Options = {kick, moves: 'full'}
        const actions: {run: () => void; wait: number}[] = []
        let rows = turn.rows
        for (const step of steps) {
            if (step.hold) actions.push({run: () => hold(live), wait: 280})
            const path = pathTo(rows, step.placement, tuck) ?? pathTo(rows, step.placement, any) ?? []
            for (const move of path) actions.push({run: () => RUN[move](live), wait: 85})
            actions.push({
                run: () => {
                    const lock = hardDrop(live)
                    if (lock) afterLock(lock)
                },
                wait: 520,
            })
            rows = step.after.rows
        }
        const token = ++playbackRef.current
        let index = 0
        const tick = () => {
            if (playbackRef.current !== token) return
            const action = actions[index++]
            if (!action) {
                if (current.status === 'showing') current.status = 'play'
                refresh()
                return
            }
            action.run()
            refresh()
            window.setTimeout(tick, action.wait)
        }
        refresh()
        window.setTimeout(tick, 400)
    }

    const nextPuzzle = (pick?: Puzzle) => {
        const current = sessionRef.current!
        // Leaving a puzzle after trying it goes in the history as unsolved.
        if (placedCount(gameRef.current!) > 0 || current.helped) settle(false)
        const next = pick ?? choose(PUZZLES, progressRef.current, current.puzzle.id)
        if (next) load(next)
        refresh()
    }

    const setEnabled = (enabled: Set<string>) => {
        commitProgress({...progressRef.current, enabled: [...enabled]})
        const current = sessionRef.current!
        const untouched = current.status === 'play' && !current.helped && placedCount(gameRef.current!) === 0
        if (untouched && !enabled.has(current.puzzle.category)) nextPuzzle()
    }

    const dispatch = (action: Action, pressed: boolean) => {
        const live = gameRef.current
        const input = inputRef.current
        const current = sessionRef.current
        if (!live || !input || !current) return
        const handling = settingsRef.current.handling
        const playing = current.status === 'play'
        if (!pressed) {
            if (action === 'moveLeft') releaseHorizontal(input, -1, handling)
            if (action === 'moveRight') releaseHorizontal(input, 1, handling)
            if (action === 'softDrop') releaseSoft(input)
            return
        }
        if (action === 'moveLeft') pressHorizontal(input, -1, live, handling, playing)
        else if (action === 'moveRight') pressHorizontal(input, 1, live, handling, playing)
        else if (action === 'softDrop') pressSoft(input, live, handling, playing)
        else if (action === 'retry') restartPuzzle()
        else if (action === 'undo') takeBack()
        else if (action === 'hint') showHint()
        else if (action === 'next') {
            if (current.status === 'solved' || current.status === 'wrong') nextPuzzle()
        } else if (action === 'hardDrop' && current.status === 'solved') {
            // A short pause so a double-tapped drop doesn't skip the result.
            if (performance.now() - current.solvedAt > 300) nextPuzzle()
        } else if (playing) {
            if (action === 'hardDrop') {
                const lock = pressHard(input, live, handling)
                if (lock) afterLock(lock)
            }
            if (action === 'rotateCW') pressRotate(input, live, handling, 1)
            if (action === 'rotateCCW') pressRotate(input, live, handling, -1)
            if (action === 'rotate180') pressRotate(input, live, handling, 2)
            if (action === 'hold') pressHold(input, live, handling)
            if (action === 'softerDrop') softStep(live)
        }
        refresh()
    }

    dispatchRef.current = dispatch

    useEffect(() => {
        let last = 0
        let frame = 0
        const loop = (now: number) => {
            const dt = last ? Math.min(50, now - last) : 0
            last = now
            const live = gameRef.current
            const input = inputRef.current
            if (live && input && sessionRef.current?.status === 'play' && !openRef.current && !listeningRef.current) {
                const active = live.active
                const before = active ? `${live.generation} ${active.rot} ${active.x} ${active.y}` : ''
                tickInput(input, live, settingsRef.current.handling, dt)
                const after = live.active ? `${live.generation} ${live.active.rot} ${live.active.x} ${live.active.y}` : ''
                if (after !== before) setFrame(n => n + 1)
            }
            frame = requestAnimationFrame(loop)
        }
        frame = requestAnimationFrame(loop)
        return () => cancelAnimationFrame(frame)
    }, [])

    const commit = (next: Settings) => {
        const clean = {...next, handling: {...next.handling}, binds: {...next.binds}}
        saveSettings(clean)
        setSettings(clean)
        if (gameRef.current) gameRef.current.kick = clean.kick
    }

    const assign = (action: Action, index: number, code: string) => {
        const binds = {...settingsRef.current.binds}
        for (const name of ACTIONS) binds[name] = binds[name].filter(item => item !== code)
        const list = binds[action].slice()
        if (index < 0 || index >= list.length) list.push(code)
        else list[index] = code
        binds[action] = list.slice(0, 4)
        commit({...settingsRef.current, binds})
    }

    useEffect(() => {
        const down = (event: KeyboardEvent) => {
            if (listeningRef.current) {
                event.preventDefault()
                if (event.code !== 'Escape') assign(listeningRef.current.action, listeningRef.current.index, event.code)
                setListening(null)
                return
            }
            if (openRef.current) {
                if (event.code === 'Escape') setOpen(false)
                return
            }
            const target = event.target
            if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return
            if (event.metaKey || event.ctrlKey && !event.code.startsWith('Control')) return
            const action = actionFor(settingsRef.current, event.code)
            if (!action) return
            event.preventDefault()
            if (event.repeat) return
            heldRef.current.add(event.code)
            dispatchRef.current(action, true)
        }
        const up = (event: KeyboardEvent) => {
            heldRef.current.delete(event.code)
            const action = actionFor(settingsRef.current, event.code)
            if (action) dispatchRef.current(action, false)
        }
        const blur = () => {
            for (const code of heldRef.current) {
                const action = actionFor(settingsRef.current, code)
                if (action) dispatchRef.current(action, false)
            }
            heldRef.current.clear()
        }
        window.addEventListener('keydown', down)
        window.addEventListener('keyup', up)
        window.addEventListener('blur', blur)
        return () => {
            window.removeEventListener('keydown', down)
            window.removeEventListener('keyup', up)
            window.removeEventListener('blur', blur)
        }
        // assign reads refs only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const effects = effectsRef.current
    const active = game.active
    const placed = placedCount(game)
    const left = piecesLeft(game)
    const preview = Math.max(8, Math.round(size * 0.55))
    const side = preview * 4 + 18
    const key = (action: Action) => keyLabel(settings.binds[action][0] ?? '—')
    const tone = session.status === 'wrong' ? 'bad' : 'good'
    const frameTone = session.status === 'wrong'
        ? 'shadow-[0_0_0_2px_rgba(248,113,113,0.7)]'
        : session.status === 'solved'
            ? 'shadow-[0_0_0_2px_rgba(74,222,128,0.7)]'
            : ''

    const enabled = new Set(progress.enabled)
    const pool = PUZZLES.filter(item => enabled.has(item.category)).length

    const actions = {
        takeBack,
        restart: restartPuzzle,
        hint: showHint,
        solution: showSolution,
        next: () => nextPuzzle(),
    }

    return (
        <div className="flex h-dvh flex-col bg-[#0e1015] font-sans text-white/90 antialiased">
            <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] px-4">
                <div className="flex min-w-0 items-center gap-2 text-sm">
                    <a className="text-white/45 no-underline hover:text-white/80" href="../">Fred Yang</a>
                    <span className="text-white/20">/</span>
                    <h1 className="m-0 truncate text-sm font-semibold">Tetris Trainer</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-white/60 hover:bg-white/5 hover:text-white"
                        onClick={event => {
                            event.currentTarget.blur()
                            setOpen(true)
                        }}
                    >
                        <GearIcon/>
                        <span className="hidden sm:inline">Settings</span>
                    </button>
                </div>
            </header>

            <div className="flex min-h-0 flex-1">
                <main className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-center gap-2 px-4 pt-3 lg:hidden">
                        <GoalBadge puzzle={puzzle}/>
                        <span className="truncate text-sm text-white/55">{trail(puzzle.category).join(' › ')}</span>
                    </div>

                    <div ref={stageRef} className="flex min-h-0 flex-1 items-center justify-center px-3 py-3">
                        <div className="flex items-start gap-3">
                            <div className="flex flex-col items-center gap-2" style={{width: side}}>
                                <ColumnLabel>Hold</ColumnLabel>
                                <div className={`rounded-lg border bg-white/[0.02] p-2 transition-colors ${session.hint?.hold ? 'border-amber-300/80' : 'border-white/[0.08]'}`}>
                                    <PiecePreview piece={game.hold} size={preview} dim={game.holdLocked}/>
                                </div>
                                {session.hint?.hold && <span className="text-center text-xs text-amber-300">Hold first</span>}
                            </div>
                            <div key={effects.shake} className={`rounded-lg transition-shadow ${frameTone}`} style={effects.shake ? {animation: 'tt-shake 320ms ease-in-out'} : undefined}>
                                <Board
                                    board={game.board}
                                    active={active && (session.status === 'play' || session.status === 'showing') ? {piece: active.piece, rot: active.rot, x: active.x, y: active.y} : null}
                                    ghost={session.status === 'play' || session.status === 'showing' ? ghostY(game) : null}
                                    hint={session.hint?.spot ?? null}
                                    marked={session.wrong}
                                    tone={tone}
                                    flash={effects.flash}
                                    glow={effects.glow}
                                    size={size}
                                >
                                    {placed === 0 && session.status === 'play' && !session.hint && Date.now() - effects.intro < 2400 && (
                                        <Callout key={effects.intro} {...introOf(puzzle)} ms={2400}/>
                                    )}
                                    {effects.callout && (
                                        <Callout key={effects.callout.key} text={effects.callout.text} detail={effects.callout.detail} ms={1700}/>
                                    )}
                                </Board>
                            </div>
                            <div className="flex flex-col items-center gap-2" style={{width: side}}>
                                <ColumnLabel>Next</ColumnLabel>
                                <div className="flex flex-col gap-1 rounded-lg border border-white/[0.08] bg-white/[0.02] p-2">
                                    {game.queue.length
                                        ? game.queue.slice(0, 6).map((piece, i) => <PiecePreview key={`${placed}-${i}-${piece}`} piece={piece} size={preview}/>)
                                        : <div className="flex items-center justify-center text-xs text-white/25" style={{width: preview * 4, height: preview * 2}}>Empty</div>}
                                </div>
                                <span className="text-xs whitespace-nowrap text-white/40 tabular-nums">{left} left</span>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-white/[0.06] px-4 py-3 lg:hidden">
                        <StatusPanel session={session} placed={placed} left={left} compact actions={actions}/>
                    </div>

                    <TouchPad dispatch={dispatch}/>
                </main>

                <aside className="hidden w-[360px] shrink-0 flex-col border-l border-white/[0.06] bg-[#11141b] lg:flex">
                    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
                        <GoalCard puzzle={puzzle} stage={stageOf(session, game)}/>
                        <StatusPanel session={session} placed={placed} left={left} actions={actions}/>
                        <Card>
                            <div className="flex items-baseline justify-between">
                                <p className="m-0 text-xs font-medium text-white/45">Puzzle types</p>
                                <span className="text-xs text-white/30 tabular-nums">{pool} puzzles</span>
                            </div>
                            <div className="mt-2 -ml-1">
                                <CategoryTree enabled={enabled} counts={COUNTS} onChange={setEnabled}/>
                            </div>
                            {!pool && <p className="m-0 mt-2 text-xs text-amber-200">Turn on at least one type to get new puzzles.</p>}
                        </Card>
                        <History progress={progress} current={puzzle.id} onPick={id => {
                            const pick = PUZZLES.find(item => item.id === id)
                            if (pick) nextPuzzle(pick)
                        }}/>
                    </div>
                    <div className="border-t border-white/[0.06] px-5 py-3 text-xs text-white/40">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <KeyHint keys={`${key('moveLeft')} ${key('moveRight')}`} label="Move"/>
                            <KeyHint keys={key('softDrop')} label="Soft drop"/>
                            <KeyHint keys={key('hardDrop')} label="Hard drop"/>
                            <KeyHint keys={`${key('rotateCCW')} ${key('rotateCW')}`} label="Rotate"/>
                            <KeyHint keys={key('rotate180')} label="180°"/>
                            <KeyHint keys={key('hold')} label="Hold"/>
                            <KeyHint keys={key('undo')} label="Take back"/>
                            <KeyHint keys={key('retry')} label="Restart"/>
                        </div>
                    </div>
                </aside>
            </div>

            {open && (
                <Drawer
                    settings={settings}
                    listening={listening}
                    onListen={setListening}
                    onChange={commit}
                    onClose={() => {
                        setListening(null)
                        setOpen(false)
                    }}
                    onResetProgress={() => commitProgress({...progressRef.current, results: [], streak: 0})}
                >
                    <div className="flex items-baseline justify-between">
                        <h3 className="m-0 text-xs font-semibold tracking-wider text-white/45 uppercase">Puzzle types</h3>
                        <span className="text-xs text-white/30 tabular-nums">{pool} puzzles</span>
                    </div>
                    <div className="mt-2 -ml-1">
                        <CategoryTree enabled={enabled} counts={COUNTS} onChange={setEnabled}/>
                    </div>
                </Drawer>
            )}
        </div>
    )
}

function GoalBadge({puzzle}: {puzzle: Puzzle}) {
    const spin = stepsOf(puzzle).some(step => step !== 'pc' && step !== 'build')
    return (
        <span className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-semibold tracking-wide uppercase ring-1 ${spin ? 'bg-violet-400/15 text-violet-200 ring-violet-300/30' : 'bg-cyan-400/15 text-cyan-200 ring-cyan-300/30'}`}>
            {goalTitle(puzzle)}
        </span>
    )
}

// Big text over the board, for the goal at the start and for what a lock did.
function Callout({text, detail, note, ms}: {text: string; detail: string | null; note?: string; ms: number}) {
    return (
        <div
            className="pointer-events-none absolute inset-x-2 top-[28%] flex flex-col items-center text-center"
            style={{animation: `tt-pop ${ms}ms ease-out forwards`}}
        >
            <span className="text-[clamp(18px,4.2vh,34px)] leading-none font-black tracking-tight text-white uppercase [text-shadow:0_2px_18px_rgba(167,139,250,0.75)]">
                {text}
            </span>
            {detail && <span className="mt-2 text-[clamp(13px,2vh,17px)] font-bold tracking-wide text-violet-200 uppercase [text-shadow:0_1px_10px_rgba(0,0,0,0.8)]">{detail}</span>}
            {note && <span className="mt-1.5 text-xs font-medium text-white/60 [text-shadow:0_1px_8px_rgba(0,0,0,0.9)]">{note}</span>}
        </div>
    )
}

// The intro over the board: which setup this is, what to do, and with what.
function introOf(puzzle: Puzzle): {text: string; detail: string; note: string} {
    const path = puzzle.category.split('/')
    const [top, sub] = path
    const stage = path[path.length - 1]
    const labels = trail(puzzle.category)
    const steps = stepsOf(puzzle)
    const count = puzzle.queue.length + (puzzle.hold ? 1 : 0)
    const note = `${count} ${count === 1 ? 'piece' : 'pieces'}${puzzle.hold ? ` · ${puzzle.hold} in hold` : ''}`
    if (top === 'tsd' || top === 'tst' || top === 'tss') {
        return sub === 'general'
            ? {text: STEP_NAME[steps[0]], detail: 'Set it up and spin', note}
            : {text: labels[1], detail: goalTitle(puzzle), note}
    }
    if (top === 'height') return {text: 'Height difference', detail: `${labels[1]} · ${goalTitle(puzzle)}`, note}
    if (top === 'sdpc') {
        return sub === 'stickspin'
            ? {text: `Stickspin · ${labels[2].split(':')[0]}`, detail: goalTitle(puzzle), note}
            : {text: `SDPC · ${labels[1].split(':')[0]}`, detail: goalTitle(puzzle), note}
    }
    if (top === 'ms2') {
        if (sub === 'bag1') return {text: 'MS2', detail: 'Build the opener', note}
        if (sub === 'bag2') return {text: 'MS2 · Bag 2', detail: `${labels[2]} · ${goalTitle(puzzle)}`, note}
        return {text: 'MS2 · Bag 3', detail: goalTitle(puzzle), note}
    }
    const build = top === 'pco' && sub === 'pc1' ? 'Build the opener' : 'Build the setup'
    const detail = stage === 'build' ? build : goalTitle(puzzle)
    // DPC leaves name the bag order the setup is for.
    if (path.length === 4) return {text: labels.slice(0, 2).join(' · '), detail: `${labels[2]} · ${detail}`, note}
    return {text: labels.slice(0, -1).join(' · '), detail, note}
}

function ColumnLabel({children}: {children: ReactNode}) {
    return <span className="text-[11px] font-semibold tracking-[0.12em] text-white/35 uppercase">{children}</span>
}

function Card({children, className = ''}: {children: ReactNode; className?: string}) {
    return <section className={`rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 ${className}`}>{children}</section>
}

function GoalCard({puzzle, stage}: {puzzle: Puzzle; stage: number}) {
    const steps = stepsOf(puzzle)
    const count = puzzle.queue.length + (puzzle.hold ? 1 : 0)
    return (
        <Card>
            <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs text-white/45">{trail(puzzle.category).join(' › ')}</span>
                <span className="text-xs text-white/35 tabular-nums">#{puzzle.id}</span>
            </div>
            <p className="m-0 mt-2 text-lg font-semibold">{goalTitle(puzzle)}</p>
            {steps.length > 1 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                    {steps.map((step, i) => (
                        <span key={i} className="flex items-center gap-1.5">
                            {i > 0 && <span className="text-white/25">→</span>}
                            <span className={`rounded-md px-1.5 py-0.5 font-semibold ${i < stage ? 'bg-green-400/15 text-green-300' : i === stage ? 'bg-white/10 text-white' : 'text-white/35'}`}>
                                {i < stage ? '✓ ' : ''}{STEP_SHORT[step]}
                            </span>
                        </span>
                    ))}
                </div>
            )}
            <p className="m-0 mt-2 text-sm leading-snug text-white/65">{goalText(puzzle)}</p>
            <p className="m-0 mt-1 text-sm text-white/40">{count} {count === 1 ? 'piece' : 'pieces'}. Hold is allowed.</p>
            {puzzle.target && (
                <div className="mt-3">
                    <p className="m-0 mb-1.5 text-xs text-white/40">Target</p>
                    <MiniBoard text={puzzle.target} size={11}/>
                </div>
            )}
            {puzzle.source && (
                <a className="mt-3 inline-block text-xs text-white/35 underline decoration-white/20 underline-offset-2 hover:text-white/70" href={puzzle.source} target="_blank" rel="noreferrer">
                    {puzzle.note ? 'More on' : 'Setup from'} {puzzle.source.includes('harddrop.com') ? 'the Hard Drop wiki' : 'four.lol'}
                </a>
            )}
        </Card>
    )
}

type PanelActions = {
    takeBack: () => void
    restart: () => void
    hint: () => void
    solution: () => void
    next: () => void
}

function StatusPanel({session, placed, left, compact, actions}: {session: Session; placed: number; left: number; compact?: boolean; actions: PanelActions}) {
    const {status} = session
    let title: string
    let text: string
    let color = 'text-white'
    if (status === 'wrong') {
        title = 'Not quite'
        text = session.wasted
            ? 'That T doesn’t spin, so it’s wasted. Take it back and save it for the T-spin.'
            : session.unbuildable
                ? `None of the setups can be built from here. ${setupsText(session.puzzle)}`
                : session.messy
                ? 'That spin works, but it doesn’t leave the ideal board. Take it back and find a cleaner way.'
                : 'That piece leaves no way to finish. Take it back and try again.'
        color = 'text-red-300'
    } else if (status === 'solved') {
        const clean = !session.helped && !session.missed
        title = session.helped ? 'Solved with help' : 'Solved!'
        text = clean ? 'Clean solve. On to the next one.' : 'Try the next one on your own.'
        color = clean ? 'text-green-300' : 'text-amber-200'
    } else if (status === 'showing') {
        title = 'Here’s one way'
        text = 'Watch the solution play out.'
        color = 'text-amber-200'
    } else if (session.hint) {
        title = 'Hint'
        text = `${session.hint.hold ? 'Hold, then put' : 'Put'} the ${session.hint.spot.piece} on the outline.`
        color = 'text-amber-200'
    } else if (session.stumped) {
        title = 'Still thinking'
        text = 'Couldn’t work out an answer from here in time. Try a piece, then ask again.'
        color = 'text-amber-200'
    } else if (session.checking && performance.now() - session.checkingSince > 200) {
        title = 'Checking…'
        text = 'Making sure that piece still leaves a way to finish.'
        color = 'text-white/70'
    } else if (placed === 0) {
        title = 'Your move'
        text = `${left} ${left === 1 ? 'piece' : 'pieces'} to work with.`
    } else {
        title = 'Still on track'
        text = `${left} ${left === 1 ? 'piece' : 'pieces'} left.`
        color = 'text-green-200'
    }
    return (
        <div className={compact ? '' : 'rounded-xl border border-white/[0.07] bg-white/[0.025] p-4'}>
            <div className={compact ? 'flex items-baseline gap-2' : ''}>
                <p key={title} className={`m-0 font-semibold ${compact ? 'text-base' : 'text-lg'} ${color}`} style={{animation: 'tt-rise 200ms ease-out'}}>{title}</p>
                <p className={`m-0 text-sm leading-snug text-white/55 ${compact ? 'truncate' : 'mt-1'}`}>{text}</p>
            </div>
            {(status === 'solved' || status === 'showing') && (session.puzzle.note ?? setupsText(session.puzzle)) && (
                <p className="m-0 mt-2 text-sm leading-snug text-white/75" style={{animation: 'tt-rise 200ms ease-out'}}>{session.puzzle.note ?? setupsText(session.puzzle)}</p>
            )}
            <div className={`flex flex-wrap gap-2 ${compact ? 'mt-2.5' : 'mt-4'}`}>
                {status === 'wrong' && <PanelButton primary onClick={actions.takeBack}>Take back</PanelButton>}
                {status === 'solved' && <PanelButton primary onClick={actions.next}>Next puzzle</PanelButton>}
                {status === 'play' && <PanelButton onClick={actions.hint}>{session.thinking ? 'Thinking…' : 'Hint'}</PanelButton>}
                {(status === 'play' || status === 'wrong') && <PanelButton onClick={actions.solution}>Solution</PanelButton>}
                {status !== 'showing' && placed > 0 && status !== 'wrong' && <PanelButton onClick={actions.takeBack}>Take back</PanelButton>}
                {placed > 0 && <PanelButton onClick={actions.restart}>Restart</PanelButton>}
                {status !== 'solved' && (
                    <PanelButton onClick={actions.next}>{status === 'wrong' ? 'Next puzzle' : 'Skip'}</PanelButton>
                )}
            </div>
        </div>
    )
}

function PanelButton({children, onClick, primary}: {children: ReactNode; onClick: () => void; primary?: boolean}) {
    return (
        <button
            type="button"
            className={primary
                ? 'rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-[#06210f] shadow-[0_2px_0_#15803d] hover:bg-green-400 active:translate-y-px active:shadow-none'
                : 'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/80 hover:border-white/20 hover:bg-white/[0.07] hover:text-white'}
            onClick={event => {
                event.currentTarget.blur()
                onClick()
            }}
        >
            {children}
        </button>
    )
}

function History({progress, current, onPick}: {progress: Progress; current: string; onPick: (id: string) => void}) {
    const recent = progress.results.slice(-24).reverse()
    const solved = progress.results.filter(result => result.solved).length
    return (
        <Card>
            <div className="flex items-baseline justify-between">
                <p className="m-0 text-xs font-medium text-white/45">Recent</p>
                <span className="text-xs text-white/40 tabular-nums">
                    {solved} solved · streak {progress.streak}
                </span>
            </div>
            {recent.length ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                    {recent.map((result, i) => {
                        const puzzle = PUZZLES.find(item => item.id === result.id)
                        const tone = result.clean
                            ? 'bg-green-400/20 text-green-200 hover:bg-green-400/30'
                            : result.solved
                                ? 'bg-amber-400/20 text-amber-200 hover:bg-amber-400/30'
                                : 'bg-red-400/20 text-red-200 hover:bg-red-400/30'
                        return (
                            <button
                                key={`${result.id}-${i}`}
                                type="button"
                                title={`#${result.id}${puzzle ? ` · ${trail(puzzle.category).join(' › ')}` : ''}`}
                                className={`h-6 min-w-6 rounded-md px-1 text-[10px] font-semibold ${tone} ${result.id === current ? 'ring-1 ring-white/50' : ''}`}
                                onClick={event => {
                                    event.currentTarget.blur()
                                    onPick(result.id)
                                }}
                            >
                                {result.solved ? '✓' : '✗'}
                            </button>
                        )
                    })}
                </div>
            ) : (
                <p className="m-0 mt-2 text-xs text-white/30">Solved and skipped puzzles show up here.</p>
            )}
        </Card>
    )
}

function KeyHint({keys, label}: {keys: string; label: string}) {
    return (
        <div className="flex items-center justify-between gap-2">
            <span>{label}</span>
            <span className="font-medium text-white/65">{keys}</span>
        </div>
    )
}

function GearIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
    )
}

function TouchPad({dispatch}: {dispatch: (action: Action, pressed: boolean) => void}) {
    const pad: [Action, string][] = [
        ['hold', 'Hold'],
        ['rotateCCW', '↺'],
        ['rotate180', '180'],
        ['rotateCW', '↻'],
        ['moveLeft', '←'],
        ['softDrop', '↓'],
        ['moveRight', '→'],
        ['hardDrop', 'Drop'],
    ]
    return (
        <div className="hidden grid-cols-4 gap-1.5 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pointer-coarse:grid">
            {pad.map(([action, label]) => (
                <button
                    key={action}
                    type="button"
                    className={`touch-none rounded-lg border border-white/10 py-3.5 text-base select-none active:bg-white/10 ${action === 'hardDrop' ? 'bg-violet-500/25 text-violet-100' : 'bg-white/[0.04]'}`}
                    onPointerDown={event => {
                        event.preventDefault()
                        event.currentTarget.setPointerCapture(event.pointerId)
                        dispatch(action, true)
                    }}
                    onPointerUp={() => dispatch(action, false)}
                    onPointerCancel={() => dispatch(action, false)}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
