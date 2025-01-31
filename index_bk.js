import { BoxGeometry, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, FogExp2, Mesh, MeshBasicMaterial, MeshPhongMaterial, Object3D, PerspectiveCamera, Points, PointsMaterial, Scene, WebGLRenderer } from "three";
import { BloomPass, EffectComposer, FilmPass, FocusShader, OrbitControls, OutputPass, RenderPass, ShaderPass } from "three/examples/jsm/Addons.js";

const threejs_container = document.getElementById('threejs_container');

let scene;
let camera;
let renderer;
let controls;

let mesh;
const meshes = [], clonemeshes = [];

let parent;

let v_width;
let v_height;

let composer, effectFocus;

init();
animate();

function init() {
    scene = new Scene();
    scene.name = "scene";
    scene.background = new Color( 0x000104 );
    scene.fog = new FogExp2( 0x000104, 0.0000675 );

    camera = new PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.set(0, 50, 500);

    renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.autoClear = false;

    threejs_container.appendChild(renderer.domElement);

    // Postprocessing

    const renderModel = new RenderPass(scene, camera);
    const effectBloom = new BloomPass(0.75);
    const effectFilm = new FilmPass();

    effectFocus = new ShaderPass(FocusShader);

    effectFocus.uniforms['screenWidth'].value = window.innerWidth * window.devicePixelRatio;
    effectFocus.uniforms['screenHeight'].value = window.innerHeight * window.devicePixelRatio;

    const outputPass = new OutputPass();

    composer = new EffectComposer(renderer);

    /*
    composer.addPass(renderModel);
    composer.addPass(effectBloom);
    composer.addPass(effectFilm);
    composer.addPass(effectFocus);
    */
    composer.addPass(outputPass);


    // Controls

    controls = new OrbitControls(camera, threejs_container);

    parent = new Object3D();
    scene.add(parent);

    const geo_testcube = new BoxGeometry(10, 10, 10);
    const testcube = new Mesh(geo_testcube, new MeshBasicMaterial({ color: 'red', side: DoubleSide }));

    //const positions = combineBuffer(testcube, 'position');
   // createMesh( positions, scene, 4.05, - 500, - 350, 600, 0xff7744 );
    scene.add(testcube);

    window.addEventListener("resize", updateSize, false);

    // Add lights

    console.log('scene', scene);
};

function combineBuffer(model, bufferName) {
    let count = 0;

    model.traverse(function (child) {
        if (child.isMesh) {
            const buffer = child.geometry.attributes[bufferName];
            count += buffer.array.length;
        }
    });

    const combined = new Float32Array(count);

    let offset = 0;

    model.traverse(function (child) {

        if (child.isMesh) {

            const buffer = child.geometry.attributes[bufferName];

            combined.set(buffer.array, offset);
            offset += buffer.array.length;

        }

    });

    return new BufferAttribute(combined, 3);
};

function createMesh( positions, scene, scale, x, y, z, color ) {
    const geometry = new BufferGeometry();
    geometry.setAttribute( 'position', positions.clone() );
    geometry.setAttribute( 'initialPosition', positions.clone() );

    geometry.attributes.position.setUsage( DynamicDrawUsage );

    const clones = [
        [ 6000, 0, - 4000 ],
        [ 5000, 0, 0 ],
        [ 1000, 0, 5000 ],
        [ 1000, 0, - 5000 ],
        [ 4000, 0, 2000 ],
        [ - 4000, 0, 1000 ],
        [ - 5000, 0, - 5000 ],
        [ 0, 0, 0 ]
    ];

    for ( let i = 0; i < clones.length; i ++ ) {

        const c = ( i < clones.length - 1 ) ? 0x252525 : color;

        mesh = new Points( geometry, new PointsMaterial( { size: 30, color: c } ) );
        mesh.scale.x = mesh.scale.y = mesh.scale.z = scale;

        mesh.position.x = x + clones[ i ][ 0 ];
        mesh.position.y = y + clones[ i ][ 1 ];
        mesh.position.z = z + clones[ i ][ 2 ];

        parent.add( mesh );

        clonemeshes.push( { mesh: mesh, speed: 0.5 + Math.random() } );

    }

    meshes.push( {
        mesh: mesh, verticesDown: 0, verticesUp: 0, direction: 0, speed: 15, delay: Math.floor( 200 + 200 * Math.random() ),
        start: Math.floor( 100 + 200 * Math.random() ),
    } );

}

function updateSize() {
    v_width = window.innerWidth;
    v_height = window.innerHeight;
    renderer.setSize(v_width, v_height);

    camera.aspect = v_width / v_height;
    camera.updateProjectionMatrix();

    effectFocus.uniforms['screenWidth'].value = window.innerWidth * window.devicePixelRatio;
    effectFocus.uniforms['screenHeight'].value = window.innerHeight * window.devicePixelRatio;
};

function animate(time) {
    /**
     * Request next frame.
     */
    /*
    const _r = () => {
        TWEEN.update(time);
        requestAnimationFrame(animate);
        //stats.update();
    };
    */

    function render() {

        let delta = 10 * clock.getDelta();

        delta = delta < 2 ? delta : 2;

        parent.rotation.y += - 0.02 * delta;

        /*
        for ( let j = 0; j < clonemeshes.length; j ++ ) {
            const cm = clonemeshes[ j ];
            cm.mesh.rotation.y += - 0.1 * delta * cm.speed;
        };

        for ( let j = 0; j < meshes.length; j ++ ) {
            const data = meshes[ j ];
            const positions = data.mesh.geometry.attributes.position;
            const initialPositions = data.mesh.geometry.attributes.initialPosition;

            const count = positions.count;

            if ( data.start > 0 ) {

                data.start -= 1;

            } else {

                if ( data.direction === 0 ) {

                    data.direction = - 1;

                }

            }

            for ( let i = 0; i < count; i ++ ) {

                const px = positions.getX( i );
                const py = positions.getY( i );
                const pz = positions.getZ( i );

                // falling down
                if ( data.direction < 0 ) {

                    if ( py > 0 ) {

                        positions.setXYZ(
                            i,
                            px + 1.5 * ( 0.50 - Math.random() ) * data.speed * delta,
                            py + 3.0 * ( 0.25 - Math.random() ) * data.speed * delta,
                            pz + 1.5 * ( 0.50 - Math.random() ) * data.speed * delta
                        );

                    } else {

                        data.verticesDown += 1;

                    }

                }

                // rising up
                if ( data.direction > 0 ) {

                    const ix = initialPositions.getX( i );
                    const iy = initialPositions.getY( i );
                    const iz = initialPositions.getZ( i );

                    const dx = Math.abs( px - ix );
                    const dy = Math.abs( py - iy );
                    const dz = Math.abs( pz - iz );

                    const d = dx + dy + dx;

                    if ( d > 1 ) {

                        positions.setXYZ(
                            i,
                            px - ( px - ix ) / dx * data.speed * delta * ( 0.85 - Math.random() ),
                            py - ( py - iy ) / dy * data.speed * delta * ( 1 + Math.random() ),
                            pz - ( pz - iz ) / dz * data.speed * delta * ( 0.85 - Math.random() )
                        );

                    } else {

                        data.verticesUp += 1;

                    }

                }

            }

            // all vertices down
            if ( data.verticesDown >= count ) {

                if ( data.delay <= 0 ) {

                    data.direction = 1;
                    data.speed = 5;
                    data.verticesDown = 0;
                    data.delay = 320;

                } else {

                    data.delay -= 1;

                }

            }

            // all vertices up
            if ( data.verticesUp >= count ) {

                if ( data.delay <= 0 ) {

                    data.direction = - 1;
                    data.speed = 15;
                    data.verticesUp = 0;
                    data.delay = 120;

                } else {

                    data.delay -= 1;

                }

            }

            positions.needsUpdate = true;

        }
            */

        composer.render( 0.01 );

    }
};

