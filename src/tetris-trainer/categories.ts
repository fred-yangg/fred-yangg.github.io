export type Category = {
    id: string
    label: string
    children?: Category[]
}

const stages = (build: string, finish: string): Category[] => [
    {id: 'build', label: build},
    {id: 'finish', label: finish},
]

// DPC setups, one per order the next bag can come in, as four.lol groups them.
const dpc = (id: string, label: string): Category => ({id, label, children: stages('Build', 'TSD → PC')})

// Puzzles belong to a leaf, named by its path: 'dpc/extra-o/jo/finish'.
export const CATEGORIES: Category[] = [
    {
        id: 'tsd',
        label: 'TSD',
        children: [
            {id: 'general', label: 'General'},
            {id: 'kaidan', label: 'Kaidan'},
            {id: 'fractal', label: 'Fractal'},
            {id: 'stsd', label: 'STSD'},
            {id: 'donation', label: 'Donation'},
        ],
    },
    {
        id: 'tst',
        label: 'TST',
        children: [
            {id: 'general', label: 'General'},
            {id: 'methods', label: 'TST setups'},
        ],
    },
    {
        id: 'tss',
        label: 'TSS',
        children: [{id: 'general', label: 'General'}],
    },
    {
        id: 'height',
        label: 'Height difference',
        children: [
            {id: '1', label: '1 row'},
            {id: '2', label: '2 rows'},
            {id: '3', label: '3 rows'},
        ],
    },
    {
        id: 'ms2',
        label: 'MS2',
        children: [
            {id: 'bag1', label: 'Bag 1: build the opener'},
            {
                id: 'bag2',
                label: 'Bag 2: setup → TST',
                children: [
                    {id: 'a', label: 'Setup A (early O)'},
                    {id: 'b', label: 'Setup B (L before I or J)'},
                    {id: 'c', label: 'Setup C'},
                    {id: 'd', label: 'Setup D (OL or LI placed)'},
                    {id: 'bonus', label: 'Bonus (I in hold)'},
                ],
            },
            {id: 'bag3', label: 'Bag 3: TSD → PC'},
        ],
    },
    {
        id: 'pco',
        label: 'PCO',
        children: [
            {id: 'pc1', label: 'PC1', children: stages('Build the opener', 'Perfect clear')},
            {id: 'pc2', label: 'PC2', children: stages('Build the setup', 'Perfect clear')},
        ],
    },
    {
        id: 'dpc',
        label: 'DPC',
        children: [
            {
                id: 'extra-o',
                label: 'Extra O',
                children: [dpc('jo', 'J before O'), dpc('oj', 'O before J'), dpc('other', 'Other')],
            },
            {
                id: 'extra-i',
                label: 'Extra I',
                children: [dpc('ol', 'O before L'), dpc('ilo', 'I before L before O'), dpc('li', 'L or J before I'), dpc('other', 'Other (O before I)')],
            },
            {
                id: 'extra-sz',
                label: 'Extra S/Z',
                children: [dpc('os', 'O before S'), dpc('so', 'S before O'), dpc('oz', 'O before Z'), dpc('zo', 'Z before O')],
            },
            {
                id: 'extra-jl',
                label: 'Extra J/L',
                children: [
                    dpc('oj-zs', 'O before J, Z before S'),
                    dpc('oj-sz', 'O before J, S before Z'),
                    dpc('jo', 'J before O'),
                    dpc('ol-sz', 'O before L, S before Z'),
                    dpc('ol-zs', 'O before L, Z before S'),
                    dpc('lo', 'L before O'),
                ],
            },
            {id: 'extra-t', label: 'Extra T', children: stages('Build', 'TSD → PC')},
        ],
    },
    {
        id: 'sdpc',
        label: 'SDPC',
        children: [
            {id: 'tss', label: 'Bag 1: build → TSS'},
            {id: 'tsd', label: 'Bag 2: build → TSD'},
            {id: 'pc', label: 'Bag 3: perfect clear'},
        ],
    },
]

export function leaves(nodes: Category[] = CATEGORIES, prefix = ''): string[] {
    return nodes.flatMap(node => {
        const path = prefix ? `${prefix}/${node.id}` : node.id
        return node.children ? leaves(node.children, path) : [path]
    })
}

// Labels from the top category down to the leaf.
export function trail(path: string): string[] {
    const out: string[] = []
    let nodes: Category[] | undefined = CATEGORIES
    for (const id of path.split('/')) {
        const node: Category | undefined = nodes?.find(item => item.id === id)
        if (!node) break
        out.push(node.label)
        nodes = node.children
    }
    return out
}
