// Makes and checks the puzzle bank on every core but one.
//
//   node src/tetris-trainer/run.mjs make [part...]
//     Remakes the parts whose names start with one given (all of them with
//     none, and any part with no file yet), then checks their puzzles.
//   node src/tetris-trainer/run.mjs test [category...]
//     Checks the puzzles whose categories start with one given, or all.

import {existsSync, mkdirSync, readdirSync, rmSync, writeFileSync} from 'node:fs'
import {availableParallelism} from 'node:os'
import {isMainThread, parentPort, Worker} from 'node:worker_threads'

const BANK = new URL('bank/', import.meta.url)
const WORKERS = Math.max(1, availableParallelism() - 1)
// Puzzles per check job. Small jobs keep every worker busy to the end.
const CHUNK = 8

const since = started => `${((Date.now() - started) / 1000).toFixed(0)}s`

if (isMainThread) {
    const [command, ...names] = process.argv.slice(2)
    if (command === 'make') await make(names)
    else if (command === 'test') await test(names)
    else {
        console.error('usage: run.mjs make [part...] | run.mjs test [category...]')
        process.exit(2)
    }
} else {
    parentPort.on('message', async job => {
        try {
            parentPort.postMessage(await work(job))
        } catch (error) {
            parentPort.postMessage({error: `${job.name ?? job.kind}: ${error.stack ?? error}`})
        }
    })
}

async function work(job) {
    if (job.kind === 'make') {
        const {makePart} = await import('./generate.ts')
        const started = Date.now()
        const text = makePart(job.name, line => parentPort.postMessage({log: `${job.name} ${since(started)} ${line}`}))
        return {text, seconds: (Date.now() - started) / 1000}
    }
    const {checkPuzzles, unitTests} = await import('./selftest.ts')
    if (job.kind === 'unit') {
        try {
            unitTests()
            return {failures: []}
        } catch (error) {
            return {failures: [`unit tests: ${error.message}`]}
        }
    }
    return {failures: checkPuzzles(job.ids)}
}

// Runs the jobs on a pool of workers and returns their results in order.
function pool(jobs) {
    const results = []
    let next = 0
    let busy = Math.min(WORKERS, jobs.length)
    return new Promise((resolve, reject) => {
        for (let w = 0; w < busy; w++) {
            const worker = new Worker(new URL(import.meta.url))
            let current = -1
            const take = () => {
                if (next >= jobs.length) {
                    void worker.terminate()
                    if (--busy === 0) resolve(results)
                    return
                }
                current = next++
                worker.postMessage(jobs[current])
            }
            worker.on('message', message => {
                if (message.log) return console.log(message.log)
                if (message.error) return reject(new Error(message.error))
                results[current] = message
                take()
            })
            worker.on('error', reject)
            take()
        }
    })
}

async function make(names) {
    const {PARTS, fileOf, indexFile} = await import('./generate.ts')
    const parts = PARTS.filter(part => !names.length || names.some(name => part.name.startsWith(name)) || !existsSync(new URL(fileOf(part.name), BANK)))
    if (!parts.length) throw new Error(`no parts match ${names.join(' ')}`)
    const started = Date.now()
    const made = await pool(parts.map(part => ({kind: 'make', name: part.name})))
    mkdirSync(BANK, {recursive: true})
    parts.forEach((part, i) => writeFileSync(new URL(fileOf(part.name), BANK), made[i].text))
    const files = new Set(PARTS.map(part => fileOf(part.name)))
    for (const file of readdirSync(BANK)) if (!files.has(file)) rmSync(new URL(file, BANK))
    writeFileSync(new URL('bank.ts', import.meta.url), indexFile())
    const slowest = parts.map((part, i) => [part.name, made[i].seconds]).sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(`made ${parts.length} parts in ${since(started)}, slowest ${slowest.map(([name, s]) => `${name} ${s.toFixed(0)}s`).join(', ')}`)
    const ids = []
    for (const part of parts) {
        const {PUZZLES} = await import(new URL(fileOf(part.name), BANK).href)
        ids.push(...PUZZLES.map(puzzle => puzzle.id))
    }
    await check(ids)
}

async function test(categories) {
    const {PUZZLES} = await import('./bank.ts')
    await check(PUZZLES.filter(puzzle => !categories.length || categories.some(category => puzzle.category.startsWith(category))).map(puzzle => puzzle.id))
}

async function check(ids) {
    const started = Date.now()
    const jobs = [{kind: 'unit'}]
    for (let i = 0; i < ids.length; i += CHUNK) jobs.push({kind: 'check', ids: ids.slice(i, i + CHUNK)})
    const failures = (await pool(jobs)).flatMap(result => result.failures)
    if (failures.length) {
        console.error(failures.join('\n'))
        console.error(`${failures.length} of ${ids.length} puzzles failed`)
        process.exit(1)
    }
    console.log(`ok, ${ids.length} puzzles checked in ${since(started)}`)
}
