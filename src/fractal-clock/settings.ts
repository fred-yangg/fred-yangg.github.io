import type {ClockSettings} from './fractalClock.ts'

export function mountSettings(settings: ClockSettings) {
    const button = document.getElementById('clock-settings-btn')
    const menu = document.getElementById('clock-settings-menu')
    const hourHand = document.getElementById('setting-hour-hand')
    if (!(button instanceof HTMLButtonElement) || !(menu instanceof HTMLElement)) {
        throw new Error('Missing settings controls')
    }
    if (!(hourHand instanceof HTMLInputElement)) {
        throw new Error('Missing hour-hand setting')
    }

    hourHand.checked = settings.hourHand

    const setOpen = (open: boolean, restoreFocus = false) => {
        button.classList.toggle('is-open', open)
        menu.classList.toggle('is-open', open)
        button.setAttribute('aria-expanded', String(open))
        if (restoreFocus && !open) button.focus()
    }

    const isOpen = () => menu.classList.contains('is-open')

    button.addEventListener('click', (event) => {
        event.stopPropagation()
        setOpen(!isOpen())
    })

    hourHand.addEventListener('change', () => {
        settings.hourHand = hourHand.checked
    })

    document.addEventListener('pointerdown', (event) => {
        if (!isOpen()) return
        const target = event.target
        if (target instanceof Node && (button.contains(target) || menu.contains(target))) return
        setOpen(false)
    })

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isOpen()) {
            event.preventDefault()
            setOpen(false, true)
        }
    })
}
