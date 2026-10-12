// Runs the solver off the main thread. Some checks take seconds.

import type {KickTable} from './kicks.ts'
import {createSolver, OutOfBudget, type Goal, type Solver, type Step, type Turn} from './solver.ts'

export type Job = {
    id: number
    kind: 'check' | 'solve'
    // Solvers keep their memo while the key stays the same.
    key: string
    goal: Goal
    kick: KickTable
    turn: Turn
}

// unsure: the search ran out of budget. It counts as still solvable, so a
// slow check never calls a good move wrong.
export type Reply = {
    id: number
    solvable: boolean
    unsure: boolean
    steps: Step[] | null
}

// Turns to expand per job. A check gives up after a few seconds at most.
const BUDGET = {check: 60_000, solve: 250_000}

let cached: {key: string; live: Solver; guide: Solver} | null = null

self.onmessage = (event: MessageEvent<Job>) => {
    const job = event.data
    const key = `${job.key}|${job.kick}`
    if (cached?.key !== key) {
        cached = {
            key,
            live: createSolver(job.goal, {kick: job.kick, moves: 'full'}),
            guide: createSolver(job.goal, {kick: job.kick, moves: 'tuck'}),
        }
    }
    cached.live.allow(BUDGET[job.kind])
    cached.guide.allow(BUDGET[job.kind])
    let reply: Reply
    try {
        reply = job.kind === 'check'
            ? {id: job.id, solvable: cached.live.solvable(job.turn), unsure: false, steps: null}
            // Prefer a line without 180s or slow soft drops, so anyone can follow it.
            : {id: job.id, solvable: true, unsure: false, steps: cached.guide.solve(job.turn) ?? cached.live.solve(job.turn)}
    } catch (error) {
        if (!(error instanceof OutOfBudget)) throw error
        reply = {id: job.id, solvable: true, unsure: true, steps: null}
    }
    self.postMessage(reply)
}
