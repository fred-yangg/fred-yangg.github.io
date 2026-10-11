import type {PresetId} from './patterns';

export type Playback = {
    inactive: boolean;
    paused: boolean;
    preset: PresetId;
    resetToken: number;
    speed: number;
    scrubbing: boolean;
    scrubTo: number | null;
    displayTime: number;
    baseGen: number;
    latestGen: number;
    population: number;
    loading: boolean;
};

const state: Playback = {
    inactive: false,
    paused: false,
    preset: 'gun',
    resetToken: 0,
    speed: 15,
    scrubbing: false,
    scrubTo: null,
    displayTime: 0,
    baseGen: 0,
    latestGen: 0,
    population: 0,
    loading: false,
};

const listeners = new Set<() => void>();

export const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

export const emit = () => {
    for (const listener of listeners) listener();
};

export default state;
