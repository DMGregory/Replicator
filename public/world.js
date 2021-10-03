import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { VRButton } from 'https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/VRButton.js';

function initializeWorld() {
    const clock = new THREE.Clock();
    const renderer = new THREE.WebGLRenderer({antialias:true});
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.05,
      100
    );

    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;

    camera.position.y = 1.5;
    camera.position.z = 0;

    document.body.appendChild(renderer.domElement);
    document.body.appendChild(VRButton.createButton(renderer));

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener('resize', resize, false);

    const primitiveGeo = {
      box: new THREE.BoxGeometry(),
      ico: new THREE.IcosahedronGeometry()
    }

    const material = new THREE.MeshLambertMaterial();

    const fadeColor = 0x5099c5;
    scene.background = new THREE.Color(fadeColor);
    scene.fog = new THREE.FogExp2(fadeColor, 0.1);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material);
    floor.receiveShadow = true;
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(35, 35, 0x333366, 0x666666);
    scene.add(grid);

    const light = new THREE.HemisphereLight(0xfffcee, 0x202555);
    scene.add(light);

    const directional = new THREE.DirectionalLight(0xfff2dd, 1.0);
    directional.position.set(-1, 7, 0.5);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    directional.castShadow = true;
    scene.add(directional);

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

  export { initializeWorld };