type stateType = {
    grid: boolean[][];
    inactive: boolean;
    lastTime: number;
    paused: boolean;
    scale: number;
}

const state: stateType = {
    grid: [],
    inactive: false,
    lastTime: 0,
    paused: false,
    scale: 1,
}

export default state;