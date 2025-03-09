import { nextGeneration } from './life';
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import state from './state';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { CUBE_SIZE, MAX_FPS, MS_PER_GEN, GEN_SPEED, MAX_TRAIL_LENGTH, RENDER_PADDING } from "./constants";
import { clamp } from '../common/utils';
import {BoxGeometry, BufferGeometry, Mesh} from "three";

const animateScene = (div: HTMLDivElement) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF);

    const camera = new THREE.OrthographicCamera(
        -aspect * 5, // left
        aspect * 5,  // right
        5,           // top
        -5,          // bottom
        0.1,         // near
        10000          // far
    );

    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(width, height);
    div.appendChild(renderer.domElement);

    // Add a cube
    const cubeMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xE06020 }),
      new THREE.MeshBasicMaterial({ color: 0xE0A000 }),
      new THREE.MeshBasicMaterial({ color: 0xE0D000 }),
      new THREE.MeshBasicMaterial({ color: 0x603060 }),
      new THREE.MeshBasicMaterial({ color: 0xC02050 }),
      new THREE.MeshBasicMaterial({ color: 0xC02050 }),
    ];

    const makeCube = (x: number, y: number, z: number) => {
        const cube = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
        cube.translate(x, y, z);
        return cube
    }

    const makeGrid = (grid: boolean[][]) => {
        const cubes: BufferGeometry[] = []
        const xLength = grid[0].length - RENDER_PADDING * 2;
        const zLength = grid.length - RENDER_PADDING * 2;
        const xOffset = 0.5 - xLength / 2;
        const zOffset = 0.5 - zLength / 2;
        grid.forEach((row, z) => {
            row.forEach((cell, x) => {
                if (!cell ||
                    x < RENDER_PADDING ||
                    x >= row.length - RENDER_PADDING ||
                    z < RENDER_PADDING ||
                    z >= grid.length - RENDER_PADDING) {
                    return;
                }
                const cube = makeCube(xOffset + x, 0, zOffset + z);
                cubes.push(cube);
            });
        });
        const gridGeometry = BufferGeometryUtils.mergeGeometries(cubes, false);
        const totalFaces = (gridGeometry.getIndex()?.count ?? 0) / 6;
        for (let i = 0; i < totalFaces; ++i) {
            gridGeometry.addGroup(i * 6, 6, i % 6);
        }
        return new THREE.Mesh(gridGeometry, cubeMaterials);
    }

    camera.position.x = 100;
    camera.position.y = 100;
    camera.position.z = 100;

    const controls = new OrbitControls( camera, renderer.domElement );
	controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = false;

    const firstGrid = makeGrid(state.grid);
    scene.add(firstGrid);

    let offset = 0;
    state.lastTime = performance.now();
    let timeDelta = 0;
    const layers: Mesh[] = [firstGrid]

    // Animation loop
    const animate = () => {
        timeDelta = performance.now() - state.lastTime;
        state.lastTime = performance.now();

        if (state.paused || state.inactive) {
            renderer.render(scene, camera);
            requestAnimationFrame( animate );
            return;
        }

        const distanceDelta = timeDelta / MS_PER_GEN
        const newLayers = Math.floor(distanceDelta + offset);
        offset = (distanceDelta + offset) % 1;

        if (newLayers > 0) {
            // reset top grid to be full height
            layers[layers.length - 1].scale.y = 1

            for (let i = 0; i < newLayers; ++i) {
                state.grid = nextGeneration(state.grid);
                const grid = makeGrid(state.grid)
                layers.push(grid);
                scene.add(grid);
            }

            while (layers.length > MAX_TRAIL_LENGTH) {
                const bottomGrid = layers.shift();
                bottomGrid?.removeFromParent()
            }
        }

        layers.forEach((layer, index) => {
            layer.position.y = index - layers.length - offset;
        })

        layers[layers.length - 1].scale.y = offset
        layers[layers.length - 1].position.y += offset / 2 - 0.5

        if (layers.length === MAX_TRAIL_LENGTH) {
            layers[0].scale.y = 1 - offset
            layers[0].position.y += offset / 2
        }

        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    };
    animate();
}

export default animateScene;