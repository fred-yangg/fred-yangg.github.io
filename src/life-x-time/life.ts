// Hashlife universe. Nodes are immutable and interned: a square is its four
// children, and each node memoizes the center of that square advanced by 2^j
// generations. Only the universe returned by the latest step stays valid.

export type Universe = {
    root: number;
    originX: number;
    originY: number;
};

const level: number[] = [];
const pop: number[] = [];
const nw: number[] = [];
const ne: number[] = [];
const sw: number[] = [];
const se: number[] = [];
const freeList: number[] = [];
const markStamp: number[] = [];

let stamp = 1;
let interned = 0;
let bucketMask = 1023;
let buckets = new Uint32Array(1024);

const succCache = new Map<number, number>();
const zero: number[] = [];

const alloc = (): number => {
    const reused = freeList.pop();
    if (reused !== undefined) return reused;
    const id = level.length;
    level.push(0);
    pop.push(0);
    nw.push(0);
    ne.push(0);
    sw.push(0);
    se.push(0);
    return id;
};

const OFF = alloc();
const ON = alloc();
pop[ON] = 1;

const hash4 = (a: number, b: number, c: number, d: number): number => {
    let h = Math.imul(a, 0x9e3779b1) ^ Math.imul(b, 0x85ebca6b);
    h = Math.imul(h ^ c, 0xc2b2ae35) ^ Math.imul(d, 0x27d4eb2f);
    return h >>> 0;
};

const place = (id: number) => {
    let i = hash4(nw[id], ne[id], sw[id], se[id]) & bucketMask;
    while (buckets[i] !== 0) i = (i + 1) & bucketMask;
    buckets[i] = id;
};

const growBuckets = () => {
    const old = buckets;
    buckets = new Uint32Array(old.length << 1);
    bucketMask = buckets.length - 1;
    for (let i = 0; i < old.length; i++) {
        const id = old[i];
        if (id !== 0) place(id);
    }
};

const join = (a: number, b: number, c: number, d: number): number => {
    let i = hash4(a, b, c, d) & bucketMask;
    for (;;) {
        const id = buckets[i];
        if (id === 0) break;
        if (nw[id] === a && ne[id] === b && sw[id] === c && se[id] === d) return id;
        i = (i + 1) & bucketMask;
    }
    if ((interned + 1) * 2 > buckets.length) {
        growBuckets();
        return join(a, b, c, d);
    }
    const id = alloc();
    level[id] = level[a] + 1;
    nw[id] = a;
    ne[id] = b;
    sw[id] = c;
    se[id] = d;
    pop[id] = pop[a] + pop[b] + pop[c] + pop[d];
    buckets[i] = id;
    interned++;
    return id;
};

const getZero = (k: number): number => {
    if (k < 0 || !Number.isInteger(k)) throw new Error('hashlife level underflow');
    const existing = zero[k];
    if (existing !== undefined) return existing;
    const child = getZero(k - 1);
    const node = join(child, child, child, child);
    zero[k] = node;
    return node;
};
zero[0] = OFF;

const centre = (id: number, ox: number, oy: number): [number, number, number] => {
    const z = getZero(level[id] - 1);
    const next = join(
        join(z, z, z, nw[id]),
        join(z, z, ne[id], z),
        join(z, sw[id], z, z),
        join(se[id], z, z, z),
    );
    const half = 2 ** (level[id] - 1);
    return [next, ox - half, oy - half];
};

const inner = (id: number): number => join(
    se[nw[id]],
    sw[ne[id]],
    ne[sw[id]],
    nw[se[id]],
);

// Each quadrant is empty outside the sixteenth nearest the center.
const isPadded = (id: number): boolean => {
    const a = nw[id];
    const b = ne[id];
    const c = sw[id];
    const d = se[id];
    return pop[a] === pop[se[se[a]]]
        && pop[b] === pop[sw[sw[b]]]
        && pop[c] === pop[ne[ne[c]]]
        && pop[d] === pop[nw[nw[d]]];
};

const pad = (id: number, ox: number, oy: number): [number, number, number] => {
    while (level[id] <= 3 || !isPadded(id)) {
        [id, ox, oy] = centre(id, ox, oy);
    }
    return [id, ox, oy];
};

const crop = (id: number, ox: number, oy: number): [number, number, number] => {
    while (level[id] > 3 && isPadded(id)) {
        const quarter = 2 ** (level[id] - 2);
        ox += quarter;
        oy += quarter;
        id = inner(id);
    }
    return [id, ox, oy];
};

const rule = (
    northwest: number, north: number, northeast: number,
    west: number, center: number, east: number,
    southwest: number, south: number, southeast: number,
): number => {
    const outer = pop[northwest] + pop[north] + pop[northeast]
        + pop[west] + pop[east]
        + pop[southwest] + pop[south] + pop[southeast];
    if (outer === 3 || (outer === 2 && pop[center] === 1)) return ON;
    return OFF;
};

// Center 2x2 of a 4x4 square, one generation later.
const life4x4 = (m: number): number => {
    const a = nw[m];
    const b = ne[m];
    const c = sw[m];
    const d = se[m];
    return join(
        rule(nw[a], ne[a], nw[b], sw[a], se[a], sw[b], nw[c], ne[c], nw[d]),
        rule(ne[a], nw[b], ne[b], se[a], sw[b], se[b], ne[c], nw[d], ne[d]),
        rule(sw[a], se[a], sw[b], nw[c], ne[c], nw[d], sw[c], se[c], sw[d]),
        rule(se[a], sw[b], se[b], ne[c], nw[d], ne[d], se[c], sw[d], se[d]),
    );
};

const cacheKey = (m: number, j: number): number => m * 64 + j;

// Center half of this node, 2^j generations later. j is at most level-2.
const successor = (m: number, j: number): number => {
    const key = cacheKey(m, j);
    const cached = succCache.get(key);
    if (cached !== undefined) return cached;

    let result: number;
    if (pop[m] === 0) {
        result = nw[m];
    } else if (level[m] === 2) {
        result = life4x4(m);
    } else {
        const step = Math.min(j, level[m] - 2);
        const a = nw[m];
        const b = ne[m];
        const c = sw[m];
        const d = se[m];
        const c1 = successor(a, step);
        const c2 = successor(join(ne[a], nw[b], se[a], sw[b]), step);
        const c3 = successor(b, step);
        const c4 = successor(join(sw[a], se[a], nw[c], ne[c]), step);
        const c5 = successor(join(se[a], sw[b], ne[c], nw[d]), step);
        const c6 = successor(join(sw[b], se[b], nw[d], ne[d]), step);
        const c7 = successor(c, step);
        const c8 = successor(join(ne[c], nw[d], se[c], sw[d]), step);
        const c9 = successor(d, step);
        if (step < level[m] - 2) {
            result = join(
                join(se[c1], sw[c2], ne[c4], nw[c5]),
                join(se[c2], sw[c3], ne[c5], nw[c6]),
                join(se[c4], sw[c5], ne[c7], nw[c8]),
                join(se[c5], sw[c6], ne[c8], nw[c9]),
            );
        } else {
            result = join(
                successor(join(c1, c2, c4, c5), step),
                successor(join(c2, c3, c5, c6), step),
                successor(join(c4, c5, c7, c8), step),
                successor(join(c5, c6, c8, c9), step),
            );
        }
    }
    succCache.set(key, result);
    return result;
};

const mark = (id: number) => {
    if (markStamp[id] === stamp) return;
    markStamp[id] = stamp;
    if (level[id] > 0) {
        mark(nw[id]);
        mark(ne[id]);
        mark(sw[id]);
        mark(se[id]);
    }
};

const freeNode = (id: number) => {
    level[id] = 0;
    pop[id] = 0;
    nw[id] = 0;
    ne[id] = 0;
    sw[id] = 0;
    se[id] = 0;
    freeList.push(id);
};

// Drop nodes nothing alive points at. Memos of the surviving tree are kept,
// including the futures those memos point at, so repeated machinery stays warm.
const collect = (roots: number[]) => {
    stamp++;
    for (let k = 0; k < zero.length; k++) mark(zero[k]);
    for (const root of roots) mark(root);
    let grew = true;
    while (grew) {
        grew = false;
        for (const [key, result] of succCache) {
            const src = Math.floor(key / 64);
            if (markStamp[src] === stamp && markStamp[result] !== stamp) {
                mark(result);
                grew = true;
            }
        }
    }
    for (const [key, result] of succCache) {
        const src = Math.floor(key / 64);
        if (markStamp[src] !== stamp) succCache.delete(key);
        else if (markStamp[result] !== stamp) throw new Error('dangling hashlife successor');
    }
    const keep: number[] = [];
    for (let id = 2; id < level.length; id++) {
        if (markStamp[id] === stamp) {
            if (level[id] > 0) keep.push(id);
        } else if (level[id] > 0) {
            freeNode(id);
        }
    }
    let size = 1024;
    while (size < keep.length * 2) size <<= 1;
    buckets = new Uint32Array(size);
    bucketMask = size - 1;
    interned = 0;
    for (const id of keep) {
        place(id);
        interned++;
    }
};

const advance = (id: number, ox: number, oy: number, generations: number): [number, number, number] => {
    if (generations === 0) return [id, ox, oy];
    const bits: number[] = [];
    let remaining = generations;
    while (remaining > 0) {
        bits.push(remaining & 1);
        remaining = Math.floor(remaining / 2);
        [id, ox, oy] = centre(id, ox, oy);
        [id, ox, oy] = centre(id, ox, oy);
    }
    for (let j = bits.length - 1; j >= 0; j--) {
        if (!bits[j]) continue;
        const quarter = 2 ** (level[id] - 2);
        ox += quarter;
        oy += quarter;
        id = successor(id, j);
    }
    return crop(id, ox, oy);
};

const take = (tiles: Map<string, number>, x: number, y: number, fallback: number): number => {
    const key = x + ',' + y;
    const found = tiles.get(key);
    if (found === undefined) return fallback;
    tiles.delete(key);
    return found;
};

export const emptyUniverse = (): Universe => ({root: getZero(4), originX: 0, originY: 0});

export const liveFromGrid = (grid: boolean[][]): Universe => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    const raw: [number, number][] = [];
    for (let y = 0; y < grid.length; y++) {
        const row = grid[y];
        for (let x = 0; x < row.length; x++) {
            if (!row[x]) continue;
            raw.push([x, y]);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }
    if (raw.length === 0) return emptyUniverse();

    const shiftX = -Math.floor((minX + maxX) / 2);
    const shiftY = -Math.floor((minY + maxY) / 2);
    let leastX = Infinity;
    let leastY = Infinity;
    const centered: [number, number][] = [];
    for (const [x, y] of raw) {
        const cx = x + shiftX;
        const cy = y + shiftY;
        centered.push([cx, cy]);
        if (cx < leastX) leastX = cx;
        if (cy < leastY) leastY = cy;
    }

    let tiles = new Map<string, number>();
    for (const [x, y] of centered) tiles.set((x - leastX) + ',' + (y - leastY), ON);

    let k = 0;
    while (tiles.size !== 1 || k === 0) {
        const next = new Map<string, number>();
        const blank = getZero(k);
        while (tiles.size > 0) {
            const key = tiles.keys().next().value;
            if (key === undefined) break;
            const comma = key.indexOf(',');
            let x = Number(key.slice(0, comma));
            let y = Number(key.slice(comma + 1));
            x &= ~1;
            y &= ~1;
            const a = take(tiles, x, y, blank);
            const b = take(tiles, x + 1, y, blank);
            const c = take(tiles, x, y + 1, blank);
            const d = take(tiles, x + 1, y + 1, blank);
            next.set((x >> 1) + ',' + (y >> 1), join(a, b, c, d));
        }
        tiles = next;
        k++;
    }

    const only = tiles.entries().next().value;
    if (only === undefined) return emptyUniverse();
    const comma = only[0].indexOf(',');
    const tx = Number(only[0].slice(0, comma));
    const ty = Number(only[0].slice(comma + 1));
    const [root, originX, originY] = pad(only[1], leastX + tx * 2 ** k, leastY + ty * 2 ** k);
    return {root, originX, originY};
};

const walk = (id: number, x: number, y: number, visit: (x: number, y: number) => void) => {
    if (pop[id] === 0) return;
    if (level[id] === 0) {
        visit(x, y);
        return;
    }
    const half = 2 ** (level[id] - 1);
    walk(nw[id], x, y, visit);
    walk(ne[id], x + half, y, visit);
    walk(sw[id], x, y + half, visit);
    walk(se[id], x + half, y + half, visit);
};

export const forEachLive = (universe: Universe, visit: (x: number, y: number) => void) => {
    walk(universe.root, universe.originX, universe.originY, visit);
};

export const population = (universe: Universe): number => pop[universe.root];

export const advanceGenerations = (universe: Universe, generations: number): Universe => {
    const [root, originX, originY] = advance(universe.root, universe.originX, universe.originY, generations);
    return {root, originX, originY};
};

export const nextGeneration = (universe: Universe): Universe => advanceGenerations(universe, 1);

// Keep every universe the caller still needs. Anything else is freed.
export const retain = (universes: Universe[]) => {
    collect(universes.length > 0 ? universes.map(universe => universe.root) : [getZero(3)]);
};

export type Bounds = {minX: number; minY: number; maxX: number; maxY: number};

export const bounds = (universe: Universe): Bounds => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const visit = (id: number, x: number, y: number) => {
        if (pop[id] === 0) return;
        if (level[id] === 0) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
            return;
        }
        const half = 2 ** (level[id] - 1);
        visit(nw[id], x, y);
        visit(ne[id], x + half, y);
        visit(sw[id], x, y + half);
        visit(se[id], x + half, y + half);
    };
    visit(universe.root, universe.originX, universe.originY);
    if (!Number.isFinite(minX)) return {minX: 0, minY: 0, maxX: 0, maxY: 0};
    return {minX, minY, maxX, maxY};
};

export const centerUniverse = (universe: Universe): Universe => {
    const box = bounds(universe);
    const shiftX = -Math.floor((box.minX + box.maxX) / 2);
    const shiftY = -Math.floor((box.minY + box.maxY) / 2);
    return {root: universe.root, originX: universe.originX + shiftX, originY: universe.originY + shiftY};
};

// Breadth-first. Stops splitting once another split would pass the instance budget,
// so a zoomed-out view stays a few boxes per pixel instead of one cube per cell.
export const walkLod = (
    universe: Universe,
    minSize: number,
    budget: number,
    emit: (x: number, y: number, size: number, population: number) => void,
) => {
    if (pop[universe.root] === 0 || budget <= 0) return 0;
    const queueId = [universe.root];
    const queueX = [universe.originX];
    const queueY = [universe.originY];
    let head = 0;
    let emitted = 0;
    while (head < queueId.length) {
        const id = queueId[head];
        const x = queueX[head];
        const y = queueY[head];
        head++;
        const size = 2 ** level[id];
        const pending = queueId.length - head;
        const canSplit = level[id] > 0 && size > minSize && emitted + pending + 4 <= budget;
        if (!canSplit) {
            emit(x, y, size, pop[id]);
            emitted++;
            continue;
        }
        const half = size / 2;
        const kids = [nw[id], ne[id], sw[id], se[id]];
        const xs = [x, x + half, x, x + half];
        const ys = [y, y, y + half, y + half];
        for (let corner = 0; corner < 4; corner++) {
            if (pop[kids[corner]] === 0) continue;
            queueId.push(kids[corner]);
            queueX.push(xs[corner]);
            queueY.push(ys[corner]);
        }
    }
    return emitted;
};

const buildFromCells = (cells: [number, number][]): Universe => {
    if (cells.length === 0) return emptyUniverse();
    let minX = Infinity;
    let minY = Infinity;
    for (const [x, y] of cells) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
    }
    let tiles = new Map<string, number>();
    for (const [x, y] of cells) tiles.set((x - minX) + ',' + (y - minY), ON);
    let k = 0;
    while (tiles.size !== 1 || k === 0) {
        const next = new Map<string, number>();
        const blank = getZero(k);
        while (tiles.size > 0) {
            const key = tiles.keys().next().value;
            if (key === undefined) break;
            const comma = key.indexOf(',');
            let x = Number(key.slice(0, comma));
            let y = Number(key.slice(comma + 1));
            x &= ~1;
            y &= ~1;
            const a = take(tiles, x, y, blank);
            const b = take(tiles, x + 1, y, blank);
            const c = take(tiles, x, y + 1, blank);
            const d = take(tiles, x + 1, y + 1, blank);
            next.set((x >> 1) + ',' + (y >> 1), join(a, b, c, d));
        }
        tiles = next;
        k++;
    }
    const only = tiles.entries().next().value;
    if (only === undefined) return emptyUniverse();
    const comma = only[0].indexOf(',');
    const tx = Number(only[0].slice(0, comma));
    const ty = Number(only[0].slice(comma + 1));
    const [root, originX, originY] = pad(only[1], minX + tx * 2 ** k, minY + ty * 2 ** k);
    return {root, originX, originY};
};

export const universeFromLife105 = (text: string): Universe => {
    const cells: [number, number][] = [];
    let originX = 0;
    let originY = 0;
    let row = 0;
    let placing = false;
    for (const line of text.split(/\r?\n/)) {
        if (line.startsWith('#P')) {
            const parts = line.trim().split(/\s+/);
            originX = Number(parts[1]);
            originY = Number(parts[2]);
            row = 0;
            placing = true;
            continue;
        }
        if (!placing || line.startsWith('#') || line.length === 0) continue;
        for (let x = 0; x < line.length; x++) {
            if (line[x] === '*') cells.push([originX + x, originY + row]);
        }
        row++;
    }
    return buildFromCells(cells);
};

const leafNode = (line: string): number => {
    const bits: number[][] = [];
    let row: number[] = [];
    for (const char of line) {
        if (char === '$') {
            bits.push(row);
            row = [];
            continue;
        }
        if (char === '*') row.push(1);
        else if (char === '.') row.push(0);
    }
    if (row.length > 0) bits.push(row);
    const cellAt = (x: number, y: number) => (bits[y] && bits[y][x] ? ON : OFF);
    const build = (x: number, y: number, size: number): number => {
        if (size === 1) return cellAt(x, y);
        const half = size / 2;
        return join(
            build(x, y, half),
            build(x + half, y, half),
            build(x, y + half, half),
            build(x + half, y + half, half),
        );
    };
    return build(0, 0, 8);
};

// Golly macrocell: 8x8 leaves, then "level nw ne sw se" nodes. Node 0 is empty.
export const universeFromMacrocell = (text: string): Universe => {
    const nodes: number[] = [0];
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (line.length === 0 || line.startsWith('#') || line.startsWith('[')) continue;
        const first = line[0];
        if (first === '.' || first === '*' || first === '$') {
            nodes.push(leafNode(line));
            continue;
        }
        const parts = line.split(' ');
        if (parts.length !== 5) continue;
        const nodeLevel = Number(parts[0]);
        const kids = [Number(parts[1]), Number(parts[2]), Number(parts[3]), Number(parts[4])];
        const child = (index: number) => index === 0 ? getZero(nodeLevel - 1) : nodes[index];
        nodes.push(join(child(kids[0]), child(kids[1]), child(kids[2]), child(kids[3])));
    }
    const root = nodes[nodes.length - 1];
    const size = 2 ** level[root];
    // Upper-left cell of the root's southeast child is (0, 1) in Golly's convention.
    return {root, originX: -size / 2, originY: 1 - size / 2};
};
