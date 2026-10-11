import {useEffect, useState} from 'react';
import {PRESETS, type PresetId} from './patterns';
import state, {emit, subscribe} from './state';

const formatGen = (generation: number) => generation.toLocaleString('en-US');
const formatPop = (population: number) => population.toLocaleString('en-US');

export const Controls = () => {
    const [view, setView] = useState({...state});

    useEffect(() => subscribe(() => setView({...state})), []);

    const latest = Math.max(view.baseGen, view.latestGen);
    const shown = Math.min(latest, Math.max(view.baseGen, Math.floor(view.displayTime)));

    return (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
            <div className="pointer-events-auto mx-auto flex max-w-3xl flex-col gap-2 rounded-xl bg-white/90 px-3 py-2 text-sm text-neutral-800 shadow-lg">
                <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2">
                        <span className="text-neutral-500">Pattern</span>
                        <select
                            className="rounded-md border border-neutral-300 bg-white px-2 py-1"
                            value={view.preset}
                            onChange={(event) => {
                                state.preset = event.target.value as PresetId;
                                state.resetToken++;
                                state.loading = true;
                                state.scrubbing = false;
                                state.scrubTo = null;
                                emit();
                            }}
                        >
                            {PRESETS.map((preset) => (
                                <option key={preset.id} value={preset.id}>
                                    {preset.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="text-neutral-500">
                        {PRESETS.find((preset) => preset.id === view.preset)?.note}
                    </span>
                    <span className="ml-auto tabular-nums">
                        {view.loading ? 'Loading…' : `${formatPop(view.population)} cells`}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        className="rounded-md bg-neutral-900 px-3 py-1 text-white"
                        onClick={() => {
                            state.paused = !state.paused;
                            emit();
                        }}
                    >
                        {view.paused ? 'Play' : 'Pause'}
                    </button>
                    <label className="flex min-w-40 flex-1 items-center gap-2">
                        <span className="text-neutral-500">Speed</span>
                        <input
                            type="range"
                            min={1}
                            max={60}
                            step={1}
                            value={view.speed}
                            onChange={(event) => {
                                state.speed = Number(event.target.value);
                                emit();
                            }}
                        />
                        <span className="w-16 tabular-nums">{view.speed} /s</span>
                    </label>
                </div>
                <label className="flex items-center gap-2">
                    <span className="text-neutral-500">Time</span>
                    <input
                        className="min-w-0 flex-1"
                        type="range"
                        min={view.baseGen}
                        max={latest}
                        step={1}
                        value={shown}
                        onPointerDown={() => {
                            state.scrubbing = true;
                        }}
                        onPointerUp={() => {
                            state.scrubbing = false;
                            emit();
                        }}
                        onPointerCancel={() => {
                            state.scrubbing = false;
                            emit();
                        }}
                        onChange={(event) => {
                            state.scrubbing = true;
                            state.scrubTo = Number(event.target.value);
                            emit();
                        }}
                    />
                    <span className="w-24 text-right tabular-nums">gen {formatGen(shown)}</span>
                </label>
            </div>
        </div>
    );
};
