import type {KickTable} from './kicks.ts'
import type {Handling} from './handling.ts'

export const FRAME_MS = 1000 / 60

export const ACTIONS = [
    'moveLeft',
    'moveRight',
    'softDrop',
    'hardDrop',
    'rotateCW',
    'rotateCCW',
    'rotate180',
    'hold',
    'undo',
    'retry',
    'hint',
    'next',
] as const

export type Action = (typeof ACTIONS)[number]

export const ACTION_LABEL: Record<Action, string> = {
    moveLeft: 'Move left',
    moveRight: 'Move right',
    softDrop: 'Soft drop',
    hardDrop: 'Hard drop',
    rotateCW: 'Rotate clockwise',
    rotateCCW: 'Rotate counter-clockwise',
    rotate180: 'Rotate 180°',
    hold: 'Hold',
    undo: 'Take back a piece',
    retry: 'Restart puzzle',
    hint: 'Hint',
    next: 'Next puzzle',
}

export type Binds = Record<Action, string[]>

export type Settings = {
    version: 1
    kick: KickTable
    handling: Handling
    binds: Binds
}

const SETTINGS_KEY = 'tetris-trainer-settings'

export const DEFAULT_SETTINGS: Settings = {
    version: 1,
    kick: 'SRS+',
    handling: {
        das: Math.round(10 * FRAME_MS),
        arr: Math.round(2 * FRAME_MS),
        dcd: 0,
        sdf: null,
        cancelDas: false,
    },
    binds: {
        moveLeft: ['ArrowLeft'],
        moveRight: ['ArrowRight'],
        softDrop: ['ArrowDown'],
        hardDrop: ['Space'],
        rotateCW: ['ArrowUp', 'KeyX'],
        rotateCCW: ['KeyZ', 'ControlLeft'],
        rotate180: ['KeyA'],
        hold: ['KeyC', 'ShiftLeft'],
        undo: ['Backspace'],
        retry: ['KeyR'],
        hint: ['KeyH'],
        next: ['Enter'],
    },
}

function cloneSettings(settings: Settings): Settings {
    return {
        version: 1,
        kick: settings.kick,
        handling: {...settings.handling},
        binds: {
            moveLeft: settings.binds.moveLeft.slice(),
            moveRight: settings.binds.moveRight.slice(),
            softDrop: settings.binds.softDrop.slice(),
            hardDrop: settings.binds.hardDrop.slice(),
            rotateCW: settings.binds.rotateCW.slice(),
            rotateCCW: settings.binds.rotateCCW.slice(),
            rotate180: settings.binds.rotate180.slice(),
            hold: settings.binds.hold.slice(),
            undo: settings.binds.undo.slice(),
            retry: settings.binds.retry.slice(),
            hint: settings.binds.hint.slice(),
            next: settings.binds.next.slice(),
        },
    }
}

function clamp(n: number, min: number, max: number): number {
    if (!Number.isFinite(n)) return min
    return Math.min(max, Math.max(min, Math.round(n)))
}

function asCodes(value: unknown): string[] {
    if (!Array.isArray(value)) return []
    const codes: string[] = []
    for (const item of value) {
        if (typeof item !== 'string' || item.length === 0 || item.length > 32) continue
        if (!codes.includes(item)) codes.push(item)
        if (codes.length === 4) break
    }
    return codes
}

export function normalizeSettings(value: unknown): Settings {
    const base = cloneSettings(DEFAULT_SETTINGS)
    if (!value || typeof value !== 'object') return base
    const raw = value as Partial<Settings>
    if (raw.kick === 'SRS' || raw.kick === 'SRS+') base.kick = raw.kick
    const handling = raw.handling
    if (handling && typeof handling === 'object') {
        if ('das' in handling) base.handling.das = clamp(Number(handling.das), 0, 333)
        if ('arr' in handling) base.handling.arr = clamp(Number(handling.arr), 0, 167)
        if ('dcd' in handling) base.handling.dcd = clamp(Number(handling.dcd), 0, 167)
        if ('sdf' in handling) {
            if (handling.sdf == null) base.handling.sdf = null
            else {
                const speed = Number(handling.sdf)
                base.handling.sdf = speed >= 41 ? null : clamp(speed, 1, 40)
            }
        }
        if (typeof handling.cancelDas === 'boolean') base.handling.cancelDas = handling.cancelDas
    }
    if (raw.binds && typeof raw.binds === 'object') {
        // Stored keys win. Actions added since then get their defaults
        // unless a stored action already uses the key.
        const stored = raw.binds as Partial<Binds>
        const used = new Set<string>()
        for (const action of ACTIONS) {
            if (!(action in stored)) continue
            base.binds[action] = asCodes(stored[action]).filter(code => !used.has(code))
            for (const code of base.binds[action]) used.add(code)
        }
        for (const action of ACTIONS) {
            if (!(action in stored)) base.binds[action] = base.binds[action].filter(code => !used.has(code))
        }
    }
    return base
}

export function loadSettings(): Settings {
    try {
        const raw = localStorage.getItem(SETTINGS_KEY)
        if (!raw) return cloneSettings(DEFAULT_SETTINGS)
        return normalizeSettings(JSON.parse(raw))
    } catch {
        return cloneSettings(DEFAULT_SETTINGS)
    }
}

export function saveSettings(settings: Settings) {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizeSettings(settings)))
    } catch {
        // Private windows can refuse storage. Settings still apply until reload.
    }
}

export function defaultSettings(): Settings {
    return cloneSettings(DEFAULT_SETTINGS)
}

export function actionFor(settings: Settings, code: string): Action | null {
    for (const action of ACTIONS) {
        if (settings.binds[action].includes(code)) return action
    }
    return null
}

export function keyLabel(code: string): string {
    const named: Record<string, string> = {
        ArrowLeft: '←',
        ArrowRight: '→',
        ArrowUp: '↑',
        ArrowDown: '↓',
        Space: 'Space',
        ShiftLeft: 'Shift',
        ShiftRight: 'Right Shift',
        ControlLeft: 'Ctrl',
        ControlRight: 'Right Ctrl',
        AltLeft: 'Alt',
        AltRight: 'Right Alt',
        MetaLeft: 'Cmd',
        MetaRight: 'Right Cmd',
        Enter: 'Enter',
        Backspace: 'Backspace',
        Tab: 'Tab',
        CapsLock: 'Caps',
    }
    if (named[code]) return named[code]
    if (code.startsWith('Key')) return code.slice(3)
    if (code.startsWith('Digit')) return code.slice(5)
    if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`
    return code
}

export function framesOf(ms: number): string {
    return (ms / FRAME_MS).toFixed(ms % FRAME_MS === 0 ? 0 : 1)
}
