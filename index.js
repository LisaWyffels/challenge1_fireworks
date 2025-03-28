import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { FocusShader } from 'three/addons/shaders/FocusShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import TWEEN from "@tweenjs/tween.js";
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dot, cross, norm } from 'https://alikim.com/_v1_jsm/geometry.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';



const loader = new GLTFLoader();

let camera, scene, renderer;
let composer, effectFocus;
let stats;
let last_pos = 0;

let group_splines;

let mixer;

const clock = new THREE.Clock();

init();

function init() {
    const container = document.querySelector('#threejs_container');

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000104);
    scene.fog = new THREE.FogExp2(0x000104, 0.0000675);

    // Renderer
    renderer = new THREE.WebGLRenderer();
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.localClippingEnabled = true;
    renderer.autoClear = false;
    container.appendChild(renderer.domElement);

    // Camera
    camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 5000);
    camera.position.set(0, 700, 700);
    camera.lookAt(scene.position);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);

    const ambi_light = new THREE.AmbientLight(0x404040, 1);
    scene.add(ambi_light);

    const dir_light = new THREE.DirectionalLight(0xffffff, 1);
    dir_light.position.set(1, 1, 1);
    scene.add(dir_light);

    // Test


    const geo_cube = new THREE.CylinderGeometry(120, 120, 120);
    const cube = new THREE.Mesh(geo_cube);
    //scene.add(cube);

    //createSingleSpline();

    // postprocessing

    /*
    const nest1 = createSingleNest(100, 3, 20);
    scene.add(nest1);
    */

    const bird = createSingleBird();
    scene.add(bird);

    window.addEventListener('resize', onWindowResize);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    camera.lookAt(scene.position);

    renderer.setSize(window.innerWidth, window.innerHeight);

};

function animate(time) {
    const delta = clock.getDelta();

    if(mixer){
        mixer.update(delta);
    }

    //controls.update();

    //stats.update();

    renderer.render(scene, camera);
};

function createSingleSpline() {
    // Spline
    const ellipse_curve = new THREE.EllipseCurve(
        0, 0,            // ax, aY
        10, 5,           // xRadius, yRadius
        0, 2 * Math.PI,  // aStartAngle, aEndAngle
        false,            // aClockwise
        0                 // aRotation
    );

    const points_ellipse = ellipse_curve.getPoints(50);
    const shape_ellipse = new THREE.Shape(points_ellipse);

    const size_x = 100;
    const size_y = 500;
    const line_curve = new THREE.CubicBezierCurve3(
        new THREE.Vector3(-size_x, 0, 0),
        new THREE.Vector3(-size_x * 2, size_y, 0),
        new THREE.Vector3(size_x * 2, size_y, 0),
        new THREE.Vector3(size_x, 0, 0)
    );

    const extrudeSettings2 = {
        steps: 200,
        bevelEnabled: false,
        extrudePath: line_curve
    };

    const geometry1 = new THREE.ExtrudeGeometry(shape_ellipse, extrudeSettings2);
    const material2 = new THREE.MeshPhongMaterial({ color: 0xff8000, wireframe: false, });

    const mesh2 = new THREE.InstancedMesh(geometry1, material2, 10);
    scene.add(mesh2);

    const radius = 550;
    const pos = new THREE.Vector3(0, 0, 0);
    const rotation = new THREE.Quaternion(0, 0, 0, 1);
    const scale = new THREE.Vector3(1, 1, 1);
    const matrix = new THREE.Matrix4();

    const single_vector = [0, -1, 0];
    const vectors = [
        [0, 1, 0],
        [-.75, 0, 0],
        /*
        [0, -1, 0],
        [1, 0, 0],
        [-1, 0, 0],
        [0, -.5, 0],
        [.5, 0, 0],
        [0, .5, 0],
        [-.5, 0, 0],
        [-.25, 0, 0],
        */
    ];

    const quaternFromVects = (v1, v2, err = 0.0001) => {
        const costh = dot(v1, v2);
        if (costh > -1 + err) {
            const q = [costh + 1, ...cross(...v1, ...v2)];
            return norm(q);
        } else {
            const aux = [0, 0, 0];
            const va = v1.map(Math.abs);
            let [min, ind] = [va[0], 0];
            if (va[1] < min) { min = va[1]; ind = 1; }
            if (va[2] < min) ind = 2;
            aux[ind] = 1;
            const orth = norm(cross(...v1, ...aux));
            return [0, ...orth];
        }
    };

    for (let i = 0; i < mesh2.count; i++) {
        if (vectors[i]) {

            const q = quaternFromVects(single_vector, vectors[i]);
            rotation.set(q[1], q[2], q[3], q[0]);
            pos.set(...(vectors[i].map(e => e * radius)));
            matrix.compose(pos, rotation, scale);
            mesh2.setMatrixAt(i, matrix);
        };
    }
};

function createSingleNest(nest_size, egg_amount, egg_size) {
    const group_nest = new THREE.Group();
    const geo_nest = new THREE.CylinderGeometry(nest_size, nest_size - (nest_size / 4), nest_size / 4, 24, 1, true);
    const mat_nest = new THREE.MeshPhongMaterial({ color: 0xff8000, wireframe: false, side: THREE.DoubleSide });
    const mesh_nest = new THREE.Mesh(geo_nest, mat_nest);

    const geo_nest_bottom = new THREE.CylinderGeometry(nest_size - (nest_size / 4) + 0.5, nest_size - (nest_size / 4) + 0.5, 1, 24, 1, false);
    const mesh_nest_bottom = new THREE.Mesh(geo_nest_bottom, mat_nest);
    mesh_nest_bottom.position.y = - nest_size / 8;

    group_nest.add(mesh_nest, mesh_nest_bottom);
    for (let i = 0; i < egg_amount; i++) {
        const egg = createSingleEgg();
        egg.scale.set(egg_size, egg_size, egg_size);
        group_nest.add(egg);

        const angle = Math.random() * Math.PI * 2;
        const random_radius = randomIntFromInterval(10, nest_size * 0.75);
        const egg_pos_x = Math.cos(angle) * random_radius;
        const egg_pos_y = Math.sin(angle) * random_radius;
        egg.position.set(egg_pos_x, 0, egg_pos_y);
    };

    return group_nest;
}

function createSingleEgg() {
    const points = [];

    for (let deg = 0; deg <= 180; deg += 6) {
        const rad = Math.PI * deg / 180;
        const point = new THREE.Vector2((0.72 + .08 * Math.cos(rad)) * Math.sin(rad), - Math.cos(rad)); // the "egg equation"
        points.push(point);
    };

    const geometry = new THREE.LatheGeometry(points, 32);
    const mat_egg = new THREE.MeshPhongMaterial({ color: 0x458645, wireframe: false });
    const mesh_egg = new THREE.Mesh(geometry, mat_egg);
    return mesh_egg;
};

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
};

function createSingleBird() {
    const group_bird = new THREE.Group();

    loader.load('bird8.glb', function (gltf) {
        const model = gltf.scene;
        const clips = gltf.animations;
        console.log('bird loaded', gltf);

        group_bird.add(model);

        mixer = new THREE.AnimationMixer(model);
        mixer.clipAction( gltf.animations[ 0 ] ).play();
   
    });
    /*

    const geo_body = new THREE.SphereGeometry(10, 36, 36);
    const mat_bird = new THREE.MeshPhongMaterial({color: 0xffffff, wireframe: false});
    const mesh_body = new THREE.Mesh(geo_body, mat_bird);

    const geo_wing = new THREE.BoxGeometry(20, 1, 10);
    const mesh_wing = new THREE.Mesh(geo_wing, mat_bird);
    mesh_wing.position.x = -10;

    group_bird.add(mesh_body, mesh_wing);

    */
    return group_bird;
};