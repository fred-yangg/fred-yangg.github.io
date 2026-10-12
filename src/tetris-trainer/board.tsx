import type {CSSProperties, ReactNode} from 'react'

import {HEIGHT, WIDTH} from './engine.ts'
import {cells, ID_COLOR, PIECE_COLOR, type Piece, type Rot} from './pieces.ts'

export type Spot = {piece: Piece; rot: Rot; x: number; y: number}

function spotCells(spot: Spot | null): Set<number> {
    const out = new Set<number>()
    if (!spot) return out
    for (const [dx, dy] of cells(spot.piece, spot.rot)) out.add((spot.y + dy) * WIDTH + spot.x + dx)
    return out
}

function minoStyle(color: string, size: number): CSSProperties {
    const bevel = Math.max(2, Math.round(size * 0.12))
    return {
        background: color,
        boxShadow: `inset 0 ${bevel}px 0 rgba(255,255,255,0.28), inset 0 -${bevel}px 0 rgba(0,0,0,0.25), inset ${bevel}px 0 0 rgba(255,255,255,0.08), inset -${bevel}px 0 0 rgba(0,0,0,0.12)`,
        borderRadius: Math.max(1, size * 0.08),
    }
}

export function Board({
    board,
    active,
    ghost,
    hint,
    marked,
    tone,
    flash,
    glow,
    size,
    children,
}: {
    board: ArrayLike<number>
    active: Spot | null
    ghost: number | null
    hint: Spot | null
    marked: number[]
    tone: 'good' | 'bad'
    flash: {rows: number[]; key: number} | null
    glow: {cells: number[]; key: number} | null
    size: number
    children?: ReactNode
}) {
    const live = spotCells(active)
    const shadow = spotCells(active && ghost != null && ghost !== active.y ? {...active, y: ghost} : null)
    const target = spotCells(hint)
    const mark = new Set(marked)
    const markColor = tone === 'good' ? '#86efac' : '#fecaca'
    return (
        <div
            className="relative overflow-hidden rounded-lg border border-white/10 bg-[#0a0c11] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]"
            style={{
                width: size * WIDTH + 2,
                height: size * HEIGHT + 2,
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                backgroundSize: `${size}px ${size}px`,
                backgroundPosition: '-1px -1px',
            }}
        >
            <div className="grid" style={{gridTemplateColumns: `repeat(${WIDTH}, ${size}px)`, gridTemplateRows: `repeat(${HEIGHT}, ${size}px)`}}>
                {Array.from({length: WIDTH * HEIGHT}, (_, i) => {
                    let style: CSSProperties | undefined
                    if (active && live.has(i)) style = minoStyle(PIECE_COLOR[active.piece], size)
                    else if (board[i]) style = minoStyle(ID_COLOR[board[i]], size)
                    else if (active && shadow.has(i)) {
                        const color = PIECE_COLOR[active.piece]
                        style = {
                            background: `${color}47`,
                            boxShadow: `inset 0 0 0 ${Math.max(1.5, Math.round(size * 0.07))}px ${color}d9`,
                            borderRadius: Math.max(1, size * 0.08),
                        }
                    }
                    const hinted = target.has(i) && !live.has(i)
                    const marked = mark.has(i) && board[i] !== 0
                    return (
                        <div key={i} className="relative" style={style}>
                            {marked && (
                                <div
                                    className="absolute inset-0 rounded-[inherit]"
                                    style={{
                                        background: 'repeating-linear-gradient(135deg, rgba(10,12,17,0.55) 0 3px, transparent 3px 7px)',
                                        boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * 0.09))}px ${markColor}`,
                                    }}
                                />
                            )}
                            {hinted && (
                                <div
                                    className="absolute inset-[2px] rounded-[3px] border-2 border-dashed border-amber-300"
                                    style={{animation: 'tt-pulse 1.2s ease-in-out infinite', background: 'rgba(252,211,77,0.2)'}}
                                />
                            )}
                        </div>
                    )
                })}
            </div>
            {glow && glow.cells.map(cell => (
                <div
                    key={`${glow.key}-${cell}`}
                    className="pointer-events-none absolute rounded-[3px]"
                    style={{
                        left: (cell % WIDTH) * size + 1,
                        top: Math.floor(cell / WIDTH) * size + 1,
                        width: size,
                        height: size,
                        boxShadow: `inset 0 0 0 ${Math.max(2, Math.round(size * 0.09))}px #86efac, 0 0 ${size * 0.5}px rgba(134,239,172,0.55)`,
                        animation: 'tt-flash 700ms ease-out forwards',
                    }}
                />
            ))}
            {flash && flash.rows.map(row => (
                <div
                    key={`${flash.key}-${row}`}
                    className="pointer-events-none absolute right-0 left-0 bg-white"
                    style={{top: row * size + 1, height: size, animation: 'tt-flash 320ms ease-out forwards'}}
                />
            ))}
            {children}
        </div>
    )
}

// A piece in spawn orientation, trimmed to its own cells and centered.
export function PiecePreview({piece, size, dim}: {piece: Piece | null; size: number; dim?: boolean}) {
    const box = {width: size * 4, height: size * 2}
    if (!piece) return <div style={box}/>
    const shape = cells(piece, 0)
    const xs = shape.map(([x]) => x)
    const ys = shape.map(([, y]) => y)
    const w = Math.max(...xs) - Math.min(...xs) + 1
    const h = Math.max(...ys) - Math.min(...ys) + 1
    return (
        <div className="relative" style={{...box, opacity: dim ? 0.35 : 1}}>
            {shape.map(([x, y]) => (
                <div
                    key={`${x}-${y}`}
                    className="absolute"
                    style={{
                        ...minoStyle(PIECE_COLOR[piece], size),
                        width: size,
                        height: size,
                        left: (x - Math.min(...xs) + (4 - w) / 2) * size,
                        top: (y - Math.min(...ys) + (2 - h) / 2) * size,
                    }}
                />
            ))}
        </div>
    )
}

// A small static board, for showing a setup to build.
export function MiniBoard({text, size}: {text: string; size: number}) {
    const rows = text.split('/')
    return (
        <div
            className="grid w-fit gap-px rounded-md border border-white/[0.08] bg-[#0a0c11] p-1"
            style={{gridTemplateColumns: `repeat(${WIDTH}, ${size}px)`, gridAutoRows: `${size}px`}}
        >
            {rows.flatMap((row, y) => [...row].map((ch, x) => {
                const color = ch === 'G' ? ID_COLOR[8] : ch in PIECE_COLOR ? PIECE_COLOR[ch as Piece] : null
                return <div key={`${y}-${x}`} className="rounded-[2px]" style={{background: color ?? 'rgba(255,255,255,0.03)'}}/>
            }))}
        </div>
    )
}
