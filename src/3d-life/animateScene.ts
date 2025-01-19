import { nextGeneration } from './life';
import Zdog from 'zdog';
import state from './state';
import { CUBE_SIZE, MAX_FPS, MS_PER_GEN, GEN_SPEED, MAX_TRAIL_LENGTH, RENDER_PADDING } from './constants';
import { clamp } from '../common/utils';

const animateScene = (element: HTMLCanvasElement | SVGSVGElement) => {
    const illo = new Zdog.Illustration({
        element: element,
        dragRotate: true,
        rotate: { x: -Zdog.TAU/8, y: -Zdog.TAU/8 },
    });

    const GRID_SIZE_X = state.grid[0].length;
    const GRID_SIZE_Z = state.grid.length;
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
        height: CUBE_SIZE,
        depth: size,
        stroke: false,
        translate: { x: x,  z: z },
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

    let offset = 0;
    state.lastTime = performance.now();
    let delta = 0;

    const boxes: Zdog.Box[][] = [];
    const anchors: Zdog.Anchor[] = [];

    const pushTopLayer = () => {
        // make anchor for new layer
        anchors.push(makeAnchor());
     
        // make grid attached to anchor
        boxes.push(makeGrid(state.grid));
     
        // calculate next generation
        state.grid = nextGeneration(state.grid);
    }

    const popBottomLayer = () => {
        boxes.shift();
        const bottomAnchor = anchors.shift();
        bottomAnchor?.remove();

        const newBottomAnchor = anchors[0];
        newBottomAnchor.remove();
        rootAnchor.addChild(newBottomAnchor);
    }

    const setLayerProps = ( index: number, height: number, y: number) => {
        boxes[index].forEach(box => {
            box.height = height;
            box.translate.y = y;
            box.updatePath();
        });
    }

    function animate() {
        delta = performance.now() - state.lastTime;
        state.lastTime = performance.now();

        if (state.paused || state.inactive) {
            // render the scene
            illo.scale = new Zdog.Vector({ x: state.scale, y: state.scale, z: state.scale });
            illo.updateRenderGraph();
            requestAnimationFrame( animate );
            return;
        }

        const newLayers = Math.floor(delta / MS_PER_GEN + offset);
        offset = (delta / MS_PER_GEN + offset) % 1;

        if (newLayers > 0) {
            // reset top grid to be full height
            setLayerProps(boxes.length-1, CUBE_SIZE, 0);

            for (let i = 0; i < newLayers; ++i) {
                pushTopLayer();
            }
            
            while (anchors.length > MAX_TRAIL_LENGTH) {
                popBottomLayer();
            }
        }

        if (MAX_TRAIL_LENGTH === 1) {
            setLayerProps(0, 0.0001, 0);
        }
        else {
            // give the impression of the grids moving down
            rootAnchor.translate.y = (anchors.length + offset) * CUBE_SIZE;

            // make top grid grow into view
            if (anchors.length > 0) {
                setLayerProps(
                    boxes.length-1, 
                    Zdog.lerp( 0, CUBE_SIZE, offset ), 
                    Zdog.lerp( CUBE_SIZE/2, 0, offset ),
                );
            }

            // make bottom grid shrink out of view
            if (anchors.length === MAX_TRAIL_LENGTH) {
                setLayerProps(
                    0, 
                    Zdog.lerp( CUBE_SIZE, 0, offset ), 
                    Zdog.lerp( 0, -CUBE_SIZE/2, offset ),
                );
            }
        }

        // render the scene
        illo.scale = new Zdog.Vector({ x: state.scale, y: state.scale, z: state.scale });
        illo.rotate.x = clamp(illo.rotate.x, -Zdog.TAU/4, 0);
        illo.updateRenderGraph();
        requestAnimationFrame( animate );
    }

    pushTopLayer();
    animate();
}

export default animateScene;