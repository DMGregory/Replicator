/*
  Douglas Gregory - 219033117

  See public/index.html for overview of whole solution.
  This code is responsible for the boilerplate of setting up a basic THREE.js scene,
  and bundling the objects we most often want to re-use into a convenient "world" data structure to pass around.

  To use: 
  import { initializeWorld } from "/world.js"; 

  const world = initializeWorld();

  This returns an object containing...
  - clock
  - renderer
  - scene
  - camera
  - floor           (ground plane we can use for raycasts so they don't continue to infinity)
  - defaultMaterial (basic grey lambert material for background objects)
  - primitiveGeo: {box, ico, sphere}
    (THREE.BufferGeometry objects for primitives we re-use a lot, so we don't need everyone allocating their own)
*/

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/VRButton.js';


// Bundles up the boilerplate of setting up a THREE.js scene for VR,
// and packs up the items we want to use most often into a "world" object - see detailed breakdown above.
function initializeWorld() {
    // Set up basic rendering features.
    const clock = new THREE.Clock();
    const renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    // Setup scene and camera.
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );
    camera.position.y = 1.5;
    camera.position.z = 0;

    // Handle resizing the canvas when the window size changes, and adapt to initial size.
    function resize() {
      if (!renderer.xr.isPresenting) {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
      }
    }
    resize();
    window.addEventListener('resize', resize, false);

    // Create a basic material for the floor or other structure.
    const material = new THREE.MeshLambertMaterial();

    // Set up an attractive fog in the distance, to obscure harsh cutoff where the geometry ends,
    // and to give some atmospheric perspective, to help with depth perception (esp. in non-VR view).
    const fadeColor = 0x5099c5;
    scene.background = new THREE.Color(fadeColor);
    scene.fog = new THREE.FogExp2(fadeColor, 0.15);

    // Create a floor plane marked with a grid to give local landmarks, so you can tell when you move.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), material);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(35, 35, 0x333366, 0x666666);
    scene.add(grid);

    // Add some lights to the scene to distinguish surfaces help see where objects are positioned,
    // using the parallax of their shadow.
    const light = new THREE.HemisphereLight(0xfffcee, 0x202555);
    scene.add(light);

    const directional = new THREE.DirectionalLight(0xfff2dd, 1.0);
    directional.position.set(-1, 7, 0.5);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    directional.castShadow = true;
    scene.add(directional);

    // Create primitives geometry for things we'll want to re-use a lot,
    // so we don't have every file making their own wastefully.
    // (In particular, boxes and spheres are currently used by replication.js
    //  to build the user avatars).
    const primitiveGeo = {
      box: new THREE.BoxGeometry(),
      ico: new THREE.IcosahedronGeometry(),
      sphere: new THREE.SphereGeometry(0.5, 17, 9),
    }

    // Package up all the items we might want to use in other scripts into a convenient
    // "world" object we can pass around, and return it.
    const world = {
      clock: clock,
      renderer: renderer,
      scene: scene,
      camera: camera,
      primitiveGeo: primitiveGeo,
      floor: floor,
      defaultMaterial: material
    }

    return world;
  }

  // Export our lone function to be used elsewhere.
  export { initializeWorld };