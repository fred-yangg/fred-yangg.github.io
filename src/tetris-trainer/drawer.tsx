import {useState, type ReactNode} from 'react'

import {
    ACTION_LABEL,
    ACTIONS,
    defaultSettings,
    framesOf,
    keyLabel,
    type Action,
    type Settings,
} from './settings.ts'

export type Listening = {action: Action; index: number} | null

export function Drawer({
    settings,
    listening,
    onListen,
    onChange,
    onClose,
    onResetProgress,
    children,
}: {
    settings: Settings
    listening: Listening
    onListen: (listening: Listening) => void
    onChange: (settings: Settings) => void
    onClose: () => void
    onResetProgress: () => void
    children?: ReactNode
}) {
    const [confirming, setConfirming] = useState(false)
    const handling = settings.handling
    const set = (patch: Partial<Settings['handling']>) => onChange({...settings, handling: {...handling, ...patch}})
    return (
        <div className="fixed inset-0 z-30 flex justify-end bg-black/55 backdrop-blur-[2px]" onClick={onClose}>
            <div
                className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#14171f] shadow-2xl"
                style={{animation: 'tt-rise 160ms ease-out'}}
                onClick={event => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                    <h2 className="m-0 text-base font-semibold">Settings</h2>
                    <button type="button" className="rounded-md px-2.5 py-1 text-sm text-white/60 hover:bg-white/5 hover:text-white" onClick={onClose}>
                        Done
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8">
                    {children && <div className="mb-6 lg:hidden">{children}</div>}
                    <Section title="Handling" text="Pieces never fall or lock on their own. They lock when you hard drop.">
                        <Slider label="DAS" hint="Delay before a held direction repeats." value={handling.das} min={0} max={333} text={`${handling.das} ms · ${framesOf(handling.das)}f`} onChange={das => set({das})}/>
                        <Slider label="ARR" hint="Repeat rate after DAS. 0 goes straight to the wall." value={handling.arr} min={0} max={167} text={`${handling.arr} ms · ${framesOf(handling.arr)}f`} onChange={arr => set({arr})}/>
                        <Slider label="DCD" hint="Pause after a rotation or a new piece before DAS continues." value={handling.dcd} min={0} max={167} text={`${handling.dcd} ms · ${framesOf(handling.dcd)}f`} onChange={dcd => set({dcd})}/>
                        <Slider
                            label="Soft drop"
                            hint="The top of the range is instant, which suits puzzles. Slower speeds let you stop mid-air."
                            value={handling.sdf ?? 41}
                            min={1}
                            max={41}
                            text={handling.sdf == null ? 'Instant' : `${handling.sdf}×`}
                            onChange={sdf => set({sdf: sdf >= 41 ? null : sdf})}
                        />
                        <label className="mt-4 flex items-start gap-2.5 text-sm text-white/80">
                            <input type="checkbox" className="mt-0.5 accent-violet-400" checked={handling.cancelDas} onChange={event => set({cancelDas: event.target.checked})}/>
                            <span>Restart DAS when the direction changes</span>
                        </label>
                    </Section>

                    <Section title="Rotation" text="SRS+ is TETR.IO’s default and changes only I-piece kicks. Every puzzle works with both.">
                        <div className="mt-3 inline-flex rounded-lg bg-black/30 p-1">
                            {(['SRS+', 'SRS'] as const).map(table => (
                                <button
                                    key={table}
                                    type="button"
                                    className={`rounded-md px-3.5 py-1.5 text-sm ${settings.kick === table ? 'bg-white/12 text-white shadow' : 'text-white/55 hover:text-white'}`}
                                    onClick={() => onChange({...settings, kick: table})}
                                >
                                    {table}
                                </button>
                            ))}
                        </div>
                    </Section>

                    <Section title="Keys" text="Click a key, then press its replacement. Escape cancels.">
                        <div className="mt-2 divide-y divide-white/5">
                            {ACTIONS.map(action => (
                                <div key={action} className="flex items-center justify-between gap-3 py-2">
                                    <span className="text-sm text-white/80">{ACTION_LABEL[action]}</span>
                                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                                        {settings.binds[action].map((code, index) => {
                                            const waiting = listening?.action === action && listening.index === index
                                            return (
                                                <button
                                                    key={code}
                                                    type="button"
                                                    className={`min-w-9 rounded-md border px-2 py-1 text-xs ${waiting ? 'border-violet-400 text-violet-300' : 'border-white/15 bg-white/[0.03] text-white/85 hover:border-white/30'}`}
                                                    onClick={() => onListen({action, index})}
                                                    onContextMenu={event => {
                                                        event.preventDefault()
                                                        onChange({...settings, binds: {...settings.binds, [action]: settings.binds[action].filter(item => item !== code)}})
                                                    }}
                                                    title="Click to change. Right-click to remove."
                                                >
                                                    {waiting ? 'Press a key' : keyLabel(code)}
                                                </button>
                                            )
                                        })}
                                        {settings.binds[action].length < 4 && (
                                            <button
                                                type="button"
                                                className={`rounded-md border border-dashed px-2 py-1 text-xs ${listening?.action === action && listening.index === -1 ? 'border-violet-400 text-violet-300' : 'border-white/15 text-white/40 hover:text-white/70'}`}
                                                onClick={() => onListen({action, index: -1})}
                                            >
                                                {listening?.action === action && listening.index === -1 ? 'Press a key' : '+'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <p className="m-0 mt-2 text-xs text-white/35">Right-click a key to remove it.</p>
                    </Section>

                    <div className="mt-8 flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
                            onClick={() => onChange(defaultSettings())}
                        >
                            Reset settings
                        </button>
                        {confirming ? (
                            <span className="flex items-center gap-2 text-sm">
                                <span className="text-white/60">Erase your history and streak?</span>
                                <button
                                    type="button"
                                    className="rounded-md bg-red-500/90 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
                                    onClick={() => {
                                        onResetProgress()
                                        setConfirming(false)
                                    }}
                                >
                                    Erase
                                </button>
                                <button type="button" className="rounded-md px-2 py-1.5 text-sm text-white/60 hover:text-white" onClick={() => setConfirming(false)}>
                                    Cancel
                                </button>
                            </span>
                        ) : (
                            <button
                                type="button"
                                className="rounded-md border border-white/15 px-3 py-1.5 text-sm text-white/80 hover:bg-white/5"
                                onClick={() => setConfirming(true)}
                            >
                                Reset history
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

function Section({title, text, children}: {title: string; text: string; children: ReactNode}) {
    return (
        <section className="mt-6 first:mt-0">
            <h3 className="m-0 text-xs font-semibold tracking-wider text-white/45 uppercase">{title}</h3>
            <p className="m-0 mt-1.5 text-sm leading-snug text-white/55">{text}</p>
            {children}
        </section>
    )
}

function Slider({
    label,
    hint,
    value,
    min,
    max,
    text,
    onChange,
}: {
    label: string
    hint: string
    value: number
    min: number
    max: number
    text: string
    onChange: (value: number) => void
}) {
    return (
        <label className="mt-4 block text-sm">
            <span className="flex items-baseline justify-between gap-3">
                <span className="text-white/85">{label}</span>
                <span className="text-white/50 tabular-nums">{text}</span>
            </span>
            <input
                className="mt-1.5 w-full accent-violet-400"
                type="range"
                min={min}
                max={max}
                step={1}
                value={value}
                onChange={event => onChange(Number(event.target.value))}
            />
            <span className="text-xs text-white/35">{hint}</span>
        </label>
    )
}
