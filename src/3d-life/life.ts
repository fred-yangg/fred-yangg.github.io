
const countAliveNeighbours = (grid: boolean[][], x: number, y: number): number => {
    let count = 0;
    for (let i = -1; i < 2; i++) {
        for (let j = -1; j < 2; j++) {
            if (i === 0 && j === 0) continue;
            const neighbourX = x + i;
            const neighbourY = y + j;
            if (neighbourX >= 0 && neighbourX < grid[0].length && neighbourY >= 0 && neighbourY < grid.length) {
                count += grid[neighbourY][neighbourX] ? 1 : 0;
            }
        }
    }
    return count;
}

export const nextGeneration = (grid: boolean[][]): boolean[][] => {
    return grid.map((row, y) =>
        row.map((cell, x) => {
        const aliveNeighbours = countAliveNeighbours(grid, x, y);
        return cell
            ? aliveNeighbours === 2 || aliveNeighbours === 3
            : aliveNeighbours === 3;
        })
    );
}

export const padGrid = (grid: boolean[][], padding: number): boolean[][] => {
    const paddedGrid = new Array(grid.length + padding * 2).fill(null).map(() => new Array(grid[0].length + padding * 2).fill(false));
    grid.forEach((row, y) => {
        row.forEach((cell, x) => {
            paddedGrid[y + padding][x + padding] = cell;
        });
    });
    return paddedGrid;
}
