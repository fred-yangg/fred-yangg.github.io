import { useEffect, useRef } from 'react';
import { nextGeneration, padGrid } from './life';
import Zdog from 'zdog';
import state from './state';
import { GosperGliderGun } from './gridPresets';

const Scene = () => {
    const mountRef = useRef<HTMLCanvasElement | null>(null);
    const [
        CUBE_SIZE = 20,
        MAX_FPS = 60,
        MAX_TRAIL_LENGTH = 6,
        GEN_SPEED = 20,
        RENDER_PADDING = 6,
    ] = [];


    state.grid = GosperGliderGun;
    state.grid = padGrid(state.grid, RENDER_PADDING);
    const GRID_SIZE_X = state.grid[0].length;
    const GRID_SIZE_Z = state.grid.length;
    
    useEffect(() => {

        const canvas = mountRef.current;
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const illo = new Zdog.Illustration({
            element: canvas,
            dragRotate: true,
            rotate: { x: -Zdog.TAU/8, y: -Zdog.TAU/8 },
        });

        const xShift = -(GRID_SIZE_X-1)/2*CUBE_SIZE;
        const zShift = -(GRID_SIZE_Z-1)/2*CUBE_SIZE;
        const rootAnchor = new Zdog.Anchor({ 
            addTo: illo, 
            translate: { x: xShift, z: zShift },
        });
        let topAnchor = rootAnchor;

        const makeAnchor = () => {
            const anchor = new Zdog.Anchor({ 
                addTo: topAnchor,
                translate: { y: -CUBE_SIZE },
            });
            topAnchor = anchor;
            return anchor;
        }

        const makeBox = (x: number, z: number, size: number) => new Zdog.Box({
            addTo: topAnchor,
            width: size,
            height: 0.001,
            depth: size,
            stroke: false,
            translate: { x: x, y: size/2,  z: z },
            color: '#C25', // default face color
            leftFace: '#EA0',
            rightFace: '#E62',
            topFace: '#ED0',
            bottomFace: '#636',
        });

        const makeGrid = (grid: boolean[][]) => {
            const boxes: Zdog.Box[] = [];
            grid.forEach((row, z) => {
                row.forEach((cell, x) => {
                    const isOutsidePaddingBounds = x < RENDER_PADDING || 
                        x >= GRID_SIZE_X-RENDER_PADDING || 
                        z < RENDER_PADDING || 
                        z >= GRID_SIZE_Z-RENDER_PADDING;

                    if (isOutsidePaddingBounds) return;
                    if (!cell) return;
                    boxes.push(makeBox(x * CUBE_SIZE, z * CUBE_SIZE, CUBE_SIZE));
                }
            )});
            return boxes;
        }

        let frame = 0;
        const boxes: Zdog.Box[][] = [];
        const anchors: Zdog.Anchor[] = [];

        function animate() {
            if (!state.paused) {
                // give the impression of the grids moving down
                rootAnchor.translate.y += CUBE_SIZE/MAX_FPS*GEN_SPEED;

                // make top grid grow into view
                if (anchors.length > 0) {
                    boxes[boxes.length-1].forEach(box => {
                        box.height += CUBE_SIZE/MAX_FPS*GEN_SPEED;
                        box.translate.y -= (CUBE_SIZE/MAX_FPS*GEN_SPEED)/2;
                        box.updatePath();
                    });
                }

                // make bottom grid shrink out of view
                if (anchors.length === MAX_TRAIL_LENGTH) {
                    boxes[0].forEach(box => {
                        box.height -= CUBE_SIZE/MAX_FPS*GEN_SPEED;
                        box.translate.y -= (CUBE_SIZE/MAX_FPS*GEN_SPEED)/2;
                        box.updatePath();
                    });
                }

                // make new grid
                if (frame % (MAX_FPS/GEN_SPEED) === 0) {
                    // make anchor for new layer
                    anchors.push(makeAnchor());

                    // make grid attached to anchor
                    boxes.push(makeGrid(state.grid));

                    // calculate next generation
                    state.grid = nextGeneration(state.grid);

                    // remove bottom anchor and grid once trail is too long
                    if (anchors.length > MAX_TRAIL_LENGTH) {
                        boxes.shift();
                        const bottomAnchor = anchors.shift();
                        bottomAnchor?.remove();

                        const newBottomAnchor = anchors[0];
                        newBottomAnchor.remove();
                        rootAnchor.addChild(newBottomAnchor);
                        rootAnchor.translate.y -= CUBE_SIZE;
                    }
                }
                ++frame;
            }

            // render the scene
            illo.scale = new Zdog.Vector({ x: state.scale, y: state.scale, z: state.scale });
            illo.updateRenderGraph();
            requestAnimationFrame( animate );
        }

        animate();
    }, []);

    return <canvas 
        ref={mountRef}
    />;
};

export default Scene;