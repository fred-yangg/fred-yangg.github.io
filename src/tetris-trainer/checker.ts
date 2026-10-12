import type {Job, Reply} from './worker.ts'

export type Checker = {
    ask: (job: Omit<Job, 'id'>) => Promise<Reply>
    busy: () => boolean
    // Drops work in flight. Its promises never settle.
    reset: () => void
}

export function createChecker(): Checker {
    let next = 1
    const waiting = new Map<number, (reply: Reply) => void>()
    const spawn = () => {
        const worker = new Worker(new URL('./worker.ts', import.meta.url), {type: 'module'})
        worker.onmessage = (event: MessageEvent<Reply>) => {
            const done = waiting.get(event.data.id)
            waiting.delete(event.data.id)
            done?.(event.data)
        }
        return worker
    }
    let worker = spawn()
    return {
        ask: job => new Promise(resolve => {
            const id = next++
            waiting.set(id, resolve)
            worker.postMessage({...job, id})
        }),
        busy: () => waiting.size > 0,
        reset: () => {
            if (!waiting.size) return
            worker.terminate()
            waiting.clear()
            worker = spawn()
        },
    }
}
