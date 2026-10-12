// Cells are offsets from the top-left of the bounding box. y grows downward.
// Rotation 0 is spawn, then clockwise: 0, R, 2, L.

export const PIECES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'] as const
export type Piece = (typeof PIECES)[number]
export type Rot = 0 | 1 | 2 | 3

export const SHAPES: Record<Piece, readonly [number, number][][]> = {
    I: [
        [[0, 1], [1, 1], [2, 1], [3, 1]],
        [[2, 0], [2, 1], [2, 2], [2, 3]],
        [[0, 2], [1, 2], [2, 2], [3, 2]],
        [[1, 0], [1, 1], [1, 2], [1, 3]],
    ],
    J: [
        [[0, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [2, 2]],
        [[1, 0], [1, 1], [0, 2], [1, 2]],
    ],
    L: [
        [[2, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [1, 2], [2, 2]],
        [[0, 1], [1, 1], [2, 1], [0, 2]],
        [[0, 0], [1, 0], [1, 1], [1, 2]],
    ],
    O: [
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
        [[1, 0], [2, 0], [1, 1], [2, 1]],
    ],
    S: [
        [[1, 0], [2, 0], [0, 1], [1, 1]],
        [[1, 0], [1, 1], [2, 1], [2, 2]],
        [[1, 1], [2, 1], [0, 2], [1, 2]],
        [[0, 0], [0, 1], [1, 1], [1, 2]],
    ],
    T: [
        [[1, 0], [0, 1], [1, 1], [2, 1]],
        [[1, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [2, 1], [1, 2]],
        [[1, 0], [0, 1], [1, 1], [1, 2]],
    ],
    Z: [
        [[0, 0], [1, 0], [1, 1], [2, 1]],
        [[2, 0], [1, 1], [2, 1], [1, 2]],
        [[0, 1], [1, 1], [1, 2], [2, 2]],
        [[1, 0], [0, 1], [1, 1], [0, 2]],
    ],
}

export const PIECE_COLOR: Record<Piece, string> = {
    I: '#3ec8ea',
    J: '#3f6fe0',
    L: '#f0a030',
    O: '#f2d230',
    S: '#55c945',
    T: '#c45bdb',
    Z: '#ef4d4d',
}

export const GARBAGE_COLOR = '#7d8da3'

// Cell ids written by the engine: 1 I, 2 J, 3 L, 4 O, 5 S, 6 T, 7 Z, 8 garbage.
export const ID_COLOR = [
    '',
    PIECE_COLOR.I,
    PIECE_COLOR.J,
    PIECE_COLOR.L,
    PIECE_COLOR.O,
    PIECE_COLOR.S,
    PIECE_COLOR.T,
    PIECE_COLOR.Z,
    GARBAGE_COLOR,
]

export function cells(piece: Piece, rot: Rot): readonly [number, number][] {
    return SHAPES[piece][rot]
}
