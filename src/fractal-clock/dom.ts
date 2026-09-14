export function mustGetById(id: string): HTMLElement {
    const el = document.getElementById(id)
    if (!(el instanceof HTMLElement)) throw new Error(`Missing #${id}`)
    return el
}

export function mustGetButton(id: string): HTMLButtonElement {
    const el = document.getElementById(id)
    if (!(el instanceof HTMLButtonElement)) throw new Error(`Missing #${id}`)
    return el
}

export function mustGetInput(id: string): HTMLInputElement {
    const el = document.getElementById(id)
    if (!(el instanceof HTMLInputElement)) throw new Error(`Missing #${id}`)
    return el
}

export function resizeCanvas(canvas: HTMLCanvasElement, cssWidth: number, cssHeight: number) {
    const dpr = Math.max(1, window.devicePixelRatio || 1)
    const w = Math.max(1, Math.floor(cssWidth * dpr))
    const h = Math.max(1, Math.floor(cssHeight * dpr))
    if (canvas.width !== w) canvas.width = w
    if (canvas.height !== h) canvas.height = h
    return dpr
}
