import {useEffect, useRef, useState} from 'react'

import {CATEGORIES, leaves, type Category} from './categories.ts'

// Checklist of categories. A parent is on when all its leaves are, mixed
// when some are, and toggling it sets every leaf under it.
export function CategoryTree({enabled, counts, onChange}: {
    enabled: Set<string>
    counts: Record<string, number>
    onChange: (enabled: Set<string>) => void
}) {
    return (
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {CATEGORIES.map(node => (
                <Branch key={node.id} node={node} path={node.id} depth={0} enabled={enabled} counts={counts} onChange={onChange}/>
            ))}
        </ul>
    )
}

function Branch({node, path, depth, enabled, counts, onChange}: {
    node: Category
    path: string
    depth: number
    enabled: Set<string>
    counts: Record<string, number>
    onChange: (enabled: Set<string>) => void
}) {
    const [open, setOpen] = useState(false)
    const box = useRef<HTMLInputElement>(null)
    const under = node.children ? leaves(node.children, path) : [path]
    const usable = under.filter(leaf => counts[leaf])
    const on = usable.filter(leaf => enabled.has(leaf)).length
    const total = usable.reduce((sum, leaf) => sum + counts[leaf], 0)
    const all = usable.length > 0 && on === usable.length
    useEffect(() => {
        if (box.current) box.current.indeterminate = on > 0 && !all
    }, [on, all])
    const toggle = () => {
        const next = new Set(enabled)
        for (const leaf of usable) {
            if (all) next.delete(leaf)
            else next.add(leaf)
        }
        onChange(next)
    }
    return (
        <li>
            <div className={`flex items-center gap-2 rounded-md py-1 pr-1 hover:bg-white/[0.04] ${usable.length ? '' : 'opacity-40'}`} style={{paddingLeft: depth * 18 + 4}}>
                <input
                    ref={box}
                    type="checkbox"
                    className="size-3.5 shrink-0 accent-violet-400"
                    checked={all}
                    disabled={!usable.length}
                    onChange={event => {
                        event.currentTarget.blur()
                        toggle()
                    }}
                    aria-label={node.label}
                />
                {node.children ? (
                    <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-1 text-left text-sm text-white/85"
                        onClick={event => {
                            event.currentTarget.blur()
                            setOpen(!open)
                        }}
                    >
                        <span className={`inline-block w-3 text-[10px] text-white/40 transition-transform ${open ? 'rotate-90' : ''}`}>▶</span>
                        <span className={`truncate ${depth === 0 ? 'font-semibold' : ''}`}>{node.label}</span>
                    </button>
                ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-white/75" onClick={toggle}>{node.label}</span>
                )}
                <span className="text-xs text-white/30 tabular-nums">{total}</span>
            </div>
            {node.children && open && (
                <ul className="m-0 list-none p-0">
                    {node.children.map(child => (
                        <Branch key={child.id} node={child} path={`${path}/${child.id}`} depth={depth + 1} enabled={enabled} counts={counts} onChange={onChange}/>
                    ))}
                </ul>
            )}
        </li>
    )
}
