import * as THREE from 'three';

import Stats from 'three/addons/libs/stats.module.js';

import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { BloomPass } from 'three/addons/postprocessing/BloomPass.js';
import { FocusShader } from 'three/addons/shaders/FocusShader.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import TWEEN from "@tweenjs/tween.js";

let camera, scene, renderer;
let composer, effectFocus;
let stats;
let last_pos = 0;

let group_splines;

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
    camera = new THREE.PerspectiveCamera(20, window.innerWidth / window.innerHeight, 1, 50000);
    camera.position.set(0, 700, 7000);
    camera.lookAt(scene.position);

    // Fireworks
    fireworksShow();

    // Test

    /*
    const geo_cube = new THREE.BoxGeometry(1500, 10, 10);
    const cube = new THREE.Mesh(geo_cube);
    scene.add(cube);
    */

    // postprocessing
    const renderModel = new RenderPass(scene, camera);
    const effectBloom = new BloomPass(0.75);

    effectFocus = new ShaderPass(FocusShader);

    effectFocus.uniforms['screenWidth'].value = window.innerWidth * window.devicePixelRatio;
    effectFocus.uniforms['screenHeight'].value = window.innerHeight * window.devicePixelRatio;

    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);

    composer.addPass(renderModel);
    composer.addPass(effectBloom);
    composer.addPass(effectFocus);
    composer.addPass(outputPass);

    window.addEventListener('resize', onWindowResize);
};

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    camera.lookAt(scene.position);

    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);

    effectFocus.uniforms['screenWidth'].value = window.innerWidth * window.devicePixelRatio;
    effectFocus.uniforms['screenHeight'].value = window.innerHeight * window.devicePixelRatio;
};

function animate(time) {
    composer.render(0.01);
    TWEEN.update(time);
    group_splines.children.forEach(function (sp) {
        if (sp.material.uniforms.u_time.value > 2.0) {
            sp.userData.type = 'shrink';
        };

        if (sp.userData.type == 'grow') {
            sp.material.uniforms.u_time.value += 0.01;
        } else {
            if(sp.material.uniforms.u_time.value > 0){
                sp.material.uniforms.u_time.value -= 0.01;
            } else {
                sp.material.uniforms.u_time.value = 0;
            };
        };
    });
};

function fireworksShow() {
    group_splines = new THREE.Group();
    scene.add(group_splines);
    createSingleSpline();
};


function createSingleSpline() {
    // Spline
    const randomPoints = [];

    const x = 100;

    for (let i = 0; i < 10; i++) {
        randomPoints.push(new THREE.Vector3(THREE.MathUtils.randFloat(- x, x), (i - 4.5) * 150, THREE.MathUtils.randFloat(- 50, 50)));
    };

    const randomSpline = new THREE.CatmullRomCurve3(randomPoints);

    const extrudeSettings2 = {
        steps: 200,
        bevelEnabled: false,
        extrudePath: randomSpline
    };

    const pts2 = [], numPts = 3;

    for (let i = 0; i < numPts * 2; i++) {
        const l = i % 2 == 1 ? 10 : 20;
        const a = i / numPts * Math.PI;
        pts2.push(new THREE.Vector2(Math.cos(a) * l, Math.sin(a) * l));
    };

    const shape2 = new THREE.Shape(pts2);

    const geometry2 = new THREE.ExtrudeGeometry(shape2, extrudeSettings2);
    geometry2.computeBoundingBox();

    const material2 = new THREE.MeshBasicMaterial({ color: 0xff8000, wireframe: false, });
    const rndmclr1 = getRandomColor();
    const rndmclr2 = getRandomColor();

    // talpha =  smoothstep(1.0, 0.0, vUv.y*u_time - 1.0);

    const mat_sky = new THREE.ShaderMaterial({
        uniforms: {
            color1: {
                value: new THREE.Color(rndmclr1)
            },
            color2: {
                value: new THREE.Color(rndmclr2)
            },
            bboxMin: {
                value: geometry2.boundingBox.min
            },
            bboxMax: {
                value: geometry2.boundingBox.max
            },
            u_time: { type: "f", value: 0 }
        },

        vertexShader: `
        uniform vec3 bboxMin;
        uniform vec3 bboxMax;

        varying vec2 vUv;
        uniform float u_time;
  
        void main() {
            vUv.y = (position.y - bboxMin.y) / (bboxMax.y - bboxMin.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
        `,

        fragmentShader: `
        uniform vec3 color1;
        uniform vec3 color2;

        uniform vec2 v_resolution;
        uniform float u_time;
        varying vec2 vUv;

        void main() {
            float talpha =  smoothstep(0.0, 1.0, 1.0 - vUv.y / u_time);
            gl_FragColor = vec4(mix(color1, color2, vUv.y), talpha);
        }
    `,

        transparent: true,
    });

    material2.onBeforeCompile = function (shader) {
        shader.fragmentShader = shader.fragmentShader.replace(
            'gl_FragColor = vec4( packNormalToRGB( normal ), opacity );',
            [
                'gl_FragColor = vec4( packNormalToRGB( normal ), opacity );',
                'gl_FragColor.a *= pow( gl_FragCoord.z, 50.0 );',
            ].join('\n')
        );
    };

    const mesh2 = new THREE.Mesh(geometry2, mat_sky);
    mesh2.userData.type = 'grow';
    group_splines.add(mesh2);

    const max_distance = 80;
    const min_distance = 10;
    last_pos = last_pos > 0 ? -randomIntFromInterval(min_distance, max_distance) * 10 : randomIntFromInterval(min_distance, max_distance) * 10;
    mesh2.position.x = last_pos;

    setTimeout(function () {
        const fade = { scale: 1 };

        const tween1 = new TWEEN.Tween(fade)
            .to({ scale: 0 }, 200)
            .easing(TWEEN.Easing.Quadratic.Out)
            .onUpdate(() => {
                mesh2.scale.y = fade.scale
            })
            .onComplete(() => {
                mesh2.parent.remove(mesh2);
            });

        //tween1.start();
        mesh2.parent.remove(mesh2);
    }, 3300);

    setTimeout(function () {
        createSingleSpline();
    }, 1500);
};

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min);
};

function getRandomColor() {
    const randomColor = "#000000".replace(/0/g, function () { return (~~(Math.random() * 16)).toString(16); });
    return randomColor;
};