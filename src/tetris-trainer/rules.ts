import type {Rot} from './pieces.ts'

export const WIDTH = 10
export const HEIGHT = 20
export const SPAWN_X = 3
export const SPAWN_Y = 0

export type Spin = 'none' | 'mini' | 'full'

// Three-corner rule. The two corners the T points at decide full or mini,
// and the fifth quarter-turn kick (the TST kick) upgrades a mini to full.
export function classifySpin(
    filled: (x: number, y: number) => boolean,
    rot: Rot,
    x: number,
    y: number,
    kickIndex: number,
    quarter: boolean,
): Spin {
    const corners = [filled(x, y), filled(x + 2, y), filled(x, y + 2), filled(x + 2, y + 2)]
    if (corners.filter(Boolean).length < 3) return 'none'
    const front: Record<Rot, [number, number]> = {0: [0, 1], 1: [1, 3], 2: [2, 3], 3: [0, 2]}
    const [a, b] = front[rot]
    if (corners[a] && corners[b]) return 'full'
    return quarter && kickIndex === 4 ? 'full' : 'mini'
}
