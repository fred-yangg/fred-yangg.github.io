import {emptyUniverse, type Universe} from './life';

type stateType = {
    inactive: boolean;
    lastTime: number;
    live: Universe;
    paused: boolean;
    scale: number;
}

const state: stateType = {
    inactive: false,
    lastTime: 0,
    live: emptyUniverse(),
    paused: false,
    scale: 1,
}

export default state;
