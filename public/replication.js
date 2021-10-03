import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/XRControllerModelFactory.min.js"; 
// Establish connection to server.


const replicas = {};

function createReplica(world, user) {
    console.log(`creating replica for user ${user.id}`);

    const r = {
        material: new THREE.MeshLambertMaterial(user.colour)
    }
    r.head = new THREE.Mesh(world.primitiveGeo.box, r.material);
    r.head.scale.set(0.2, 0.1, 0.12);

    const ball = new THREE.Mesh(world.primitiveGeo.sphere, r.material);    
    r.head.add (ball);
    ball.scale.set(1.2, 4, 2);
    ball.position.set(0, -0.55, 0.75);
    ball.castShadow = true;
    world.scene.add(r.head);

    replicas[user.id] = r;

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

function updateReplicas(world, self, others) {
    const t = world.clock.getElapsedTime();

    let p = new THREE.Vector3();
    world.camera.getWorldPosition(p);
    self.pos[0] = p.x;
    self.pos[1] = p.y;
    self.pos[2] = p.z;

    let q = new THREE.Quaternion();
    world.camera.getWorldQuaternion(q);
    self.quat[0] = q.x;
    self.quat[1] = q.y;
    self.quat[2] = q.z;
    self.quat[3] = q.w;
    
    others.forEach((o) => {
        let r = replicas[o.id];

        if (r === undefined) {
            r = createReplica(world, o);            
        }

        r.head.position.set(o.pos[0], o.pos[1], o.pos[2]);
        r.head.quaternion.set(o.quat[0], o.quat[1], o.quat[2], o.quat[3]);
        r.lastUpdate = t;
    });

    for (let key in replicas) {
        let r = replicas[key];
            if (r.lastUpdate < t) {
            console.log(`Removing replica for ${key}`, r);
            world.scene.remove(r.head);
            delete replicas[key];
        }
    }
}

export { setupLocalUser, updateReplicas };