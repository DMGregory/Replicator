import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/XRControllerModelFactory.min.js"; 
// Establish connection to server.


function createReplica(user, THREE) {
    const r = {
        material: new THREE.MeshLambertMaterial(user.colour)
    }
    r.head = new THREE.Mesh(world.primitives.box, r.material);
    r.head.scale.set(0.5, 0.2, 0.3);

    const ball = new THREE.Mesh(world.primitives.ico, r.material);
    r.head.add (ball);
    world.scene.add(r.head);

    return r;
}


// Controller handling adapted from WebXR BallShooter example:
// https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_ballshooter.html
let controller1, controller2, controllerGrip1, controllerGrip2;


function initializeControllers(world) {
    // controllers
    function onSelectStart() {
        this.userData.isSelecting = true;
    }

    function onSelectEnd() {
        this.userData.isSelecting = false;
    }

    controller1 = world.renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('connected', function (event) {
        this.add(buildController(event.data));
    });
    controller1.addEventListener('disconnected', function () {
        this.remove(this.children[0]);
    });
    world.clientSpace.add(controller1);

    controller2 = world.renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('connected', function (event) {
        this.add(buildController(event.data));
    });
    controller2.addEventListener('disconnected', function () {
        this.remove(this.children[0]);
    });
    world.clientSpace.add(controller2);

    // The XRControllerModelFactory will automatically fetch controller models
    // that match what the user is holding as closely as possible. The models
    // should be attached to the object returned from getControllerGrip in
    // order to match the orientation of the held device.
    const controllerModelFactory = new XRControllerModelFactory();

    controllerGrip1 = world.renderer.xr.getControllerGrip(0);
    controllerGrip1.add(
        controllerModelFactory.createControllerModel(controllerGrip1)
    );
    world.clientSpace.add(controllerGrip1);

    controllerGrip2 = world.renderer.xr.getControllerGrip(1);
    controllerGrip2.add(
        controllerModelFactory.createControllerModel(controllerGrip2)
    );
    world.clientSpace.add(controllerGrip2);
    }
    function buildController(data) {
    let geometry, material;

    switch (data.targetRayMode) {
        case 'tracked-pointer':
        geometry = new THREE.BufferGeometry();
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, -1], 3)
        );
        geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute([0.5, 0.5, 0.5, 0, 0, 0], 3)
        );
        material = new THREE.LineBasicMaterial({
            vertexColors: true,
            blending: THREE.AdditiveBlending,
        });
        return new THREE.Line(geometry, material);

        case 'gaze':
        geometry = new THREE.RingGeometry(0.02, 0.04, 32).translate(
            0,
            0,
            -1
        );
        material = new THREE.MeshBasicMaterial({
            opacity: 0.5,
            transparent: true,
        });
        return new THREE.Mesh(geometry, material);
    }
}


function setupLocalUser(x, y, angle, world) {
    const clientSpace = new THREE.Object3D();
    clientSpace.position.x = x;
    clientSpace.position.z = y;
    clientSpace.rotation.y = angle;    
  
    clientSpace.add(world.camera);
    world.camera.position.set(0, 1.5, 0);
    world.scene.add(clientSpace);   

    world.clientSpace = clientSpace;

    initializeControllers(world);
}

export { setupLocalUser };