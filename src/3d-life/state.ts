type stateType = {
    grid: boolean[][];
    paused: boolean;
    scale: number;
}

const state: stateType = {
    grid: [],
    paused: false,
    scale: 1,
}

export default state;