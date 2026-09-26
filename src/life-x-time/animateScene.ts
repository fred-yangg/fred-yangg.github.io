import { forEachLive, nextGeneration, type Universe } from './life';
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import state from './state';
import { CUBE_SIZE, MS_PER_GEN, MAX_TRAIL_LENGTH } from "./constants";

const FACE_COLORS = [0xE06020, 0xE0A000, 0xE0D000, 0x603060, 0xC02050, 0xC02050];

const createCubeGeometry = () => {
    const geometry = new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
    const color = new THREE.Color();
    const colors = new Float32Array(geometry.getAttribute('position').count * 3);
    for (let face = 0; face < 6; face++) {
        color.setHex(FACE_COLORS[face]);
        for (let vertex = 0; vertex < 4; vertex++) {
            color.toArray(colors, (face * 4 + vertex) * 3);
        }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.clearGroups();
    return geometry;
};

const animateScene = (div: HTMLDivElement) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspect = width / height;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFFFFFF);
    // Distance is remapped to world -Y in onBeforeCompile, so this fades the trail bottom.
    scene.fog = new THREE.Fog(0xFFFFFF, MAX_TRAIL_LENGTH * 0.5, MAX_TRAIL_LENGTH * 0.92);

    // Symmetric clip volume so orbiting head-on does not slice gliders behind the camera.
    const clipExtent = Math.max(2000, MAX_TRAIL_LENGTH * 4);
    const camera = new THREE.OrthographicCamera(
        -aspect * 5, // left
        aspect * 5,  // right
        5,           // top
        -5,          // bottom
        -clipExtent,
        clipExtent,
    );

    const renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setSize(width, height);
    div.appendChild(renderer.domElement);

    const cubeGeometry = createCubeGeometry();
    const cubeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true });
    cubeMaterial.customProgramCacheKey = () => 'life-height-fog';
    cubeMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = shader.vertexShader.replace(
            '#include <fog_vertex>',
            `
#ifdef USE_FOG
    vec4 fogWorldPosition = vec4(transformed, 1.0);
    #ifdef USE_INSTANCING
        fogWorldPosition = instanceMatrix * fogWorldPosition;
    #endif
    fogWorldPosition = modelMatrix * fogWorldPosition;
    vFogDepth = -fogWorldPosition.y;
#endif
            `,
        );
    };
    const dummy = new THREE.Object3D();

    const makeLayer = (live: Universe) => {
        const cells: number[] = [];
        forEachLive(live, (x, z) => {
            cells.push(x, z);
        });

        const count = cells.length / 2;
        if (count === 0) return new THREE.Object3D();

        const mesh = new THREE.InstancedMesh(cubeGeometry, cubeMaterial, count);
        // InstancedMesh culling uses the prototype box at the origin, not the instances.
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        for (let i = 0; i < count; i++) {
            dummy.position.set(cells[i * 2], 0, cells[i * 2 + 1]);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
        }
        return mesh;
    };

    const disposeLayer = (layer: THREE.Object3D) => {
        layer.removeFromParent();
        if (layer instanceof THREE.InstancedMesh) {
            layer.dispose();
        }
    };

    camera.position.x = 100;
    camera.position.y = 100;
    camera.position.z = 100;

    const controls = new OrbitControls( camera, renderer.domElement );
	controls.maxPolarAngle = Math.PI / 2;
    controls.enablePan = false;

    const firstGrid = makeLayer(state.live);
    scene.add(firstGrid);

    let offset = 0;
    state.lastTime = performance.now();
    let timeDelta = 0;
    const layers: THREE.Object3D[] = [firstGrid]

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
                state.live = nextGeneration(state.live);
                const layer = makeLayer(state.live)
                layers.push(layer);
                scene.add(layer);
            }

            while (layers.length > MAX_TRAIL_LENGTH) {
                const bottomGrid = layers.shift();
                if (bottomGrid) disposeLayer(bottomGrid);
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
