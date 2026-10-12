import {leaves} from './categories.ts'
import type {Puzzle} from './puzzles.ts'

// clean: solved with no wrong moves, hints, or solution.
export type Result = {
    id: string
    solved: boolean
    clean: boolean
}

export type Progress = {
    // Leaf category paths that puzzles are drawn from.
    enabled: string[]
    // Every leaf there was at the last save. Leaves added since start enabled.
    seen: string[]
    // Newest last.
    results: Result[]
    streak: number
}

const KEY = 'tetris-trainer-practice'

function fresh(): Progress {
    return {enabled: leaves(), seen: leaves(), results: [], streak: 0}
}

export function loadProgress(): Progress {
    try {
        return restore(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
    } catch {
        return fresh()
    }
}

// The leaf a leaf was split from, if any: DPC setups were split by the
// order of the bag, so 'dpc/extra-o/jo/build' came from 'dpc/extra-o/build'.
const splitFrom = (path: string) => path.replace(/^(dpc\/[^/]+)\/[^/]+(\/[^/]+)$/, '$1$2')

// A save brought up to date with the categories there are now.
export function restore(saved: unknown): Progress {
    const raw = saved as Partial<Progress> | null
    if (!raw || typeof raw !== 'object') return fresh()
    const known = new Set(leaves())
    // Saves from before this was kept had every leaf but the height ones, and
    // DPC wasn't split yet.
    const seen = new Set(Array.isArray(raw.seen) ? raw.seen : leaves().filter(path => !path.startsWith('height/')).map(splitFrom))
    const was = new Set(Array.isArray(raw.enabled) ? raw.enabled : [])
    // New leaves start on, or as the leaf they were split from was.
    const added = leaves().filter(path => !seen.has(path) && (!seen.has(splitFrom(path)) || was.has(splitFrom(path))))
    return {
        enabled: Array.isArray(raw.enabled) ? [...raw.enabled.filter(path => known.has(path)), ...added] : leaves(),
        seen: leaves(),
        results: Array.isArray(raw.results)
            ? raw.results.filter((item): item is Result => typeof item?.id === 'string' && typeof item.solved === 'boolean')
            : [],
        streak: Number.isFinite(raw.streak) ? raw.streak! : 0,
    }
}

export function saveProgress(progress: Progress) {
    try {
        localStorage.setItem(KEY, JSON.stringify(progress))
    } catch {
        // Storage can be off in private windows. Progress lasts for the visit.
    }
}

export function record(progress: Progress, id: string, solved: boolean, clean: boolean): Progress {
    return {
        ...progress,
        results: [...progress.results, {id, solved, clean}].slice(-200),
        streak: solved && clean ? progress.streak + 1 : 0,
    }
}

// A random enabled puzzle that wasn't seen recently.
export function choose(puzzles: Puzzle[], progress: Progress, current?: string): Puzzle | null {
    const enabled = new Set(progress.enabled)
    const pool = puzzles.filter(puzzle => enabled.has(puzzle.category))
    if (!pool.length) return null
    const recent = new Set(progress.results.slice(-Math.min(40, pool.length - 1)).map(result => result.id))
    if (current) recent.add(current)
    const fresh = pool.filter(puzzle => !recent.has(puzzle.id))
    const options = fresh.length ? fresh : pool
    return options[Math.floor(Math.random() * options.length)]
}
