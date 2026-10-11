import breederSource from './patterns/breeder.lif?raw';
import piSource from './patterns/pi.mc?raw';
import {GosperGliderGun} from './gridPresets';
import {centerUniverse, liveFromGrid, universeFromLife105, universeFromMacrocell, type Universe} from './life';

export type PresetId = 'gun' | 'breeder' | 'pi';

export const PRESETS: {id: PresetId; name: string; note: string}[] = [
    {id: 'gun', name: 'Glider gun', note: 'Gosper, 1970'},
    {id: 'breeder', name: 'Breeder', note: 'Gosper, early 1970s'},
    {id: 'pi', name: 'Pi calculator', note: 'Goucher, 2010'},
];

export const loadPreset = (id: PresetId): Universe => {
    if (id === 'breeder') return centerUniverse(universeFromLife105(breederSource));
    if (id === 'pi') return centerUniverse(universeFromMacrocell(piSource));
    return liveFromGrid(GosperGliderGun);
};
