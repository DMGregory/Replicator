import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/XRControllerModelFactory.min.js"; 
// Establish connection to server.

const loader = new THREE.FontLoader();
let font;
loader.load('fonts/Roboto_Regular.json', function ( loadedFont) {
    font = loadedFont;
});


const textMaterial = new THREE.MeshBasicMaterial({color:0x000000});

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

    function onConnect(event) {
        this.add(buildController(event.data));
    }

    function onRemove() {
        let child = this.children[0];
        if (child) {
            this.remove(child);
            child.geometry.dispose();
            child.material.dispose();
        }
    }

    controller1 = world.renderer.xr.getController(0);
    controller1.addEventListener('selectstart', onSelectStart);
    controller1.addEventListener('selectend', onSelectEnd);
    controller1.addEventListener('connected', onConnect); 
    controller1.addEventListener('disconnected', onRemove);
    world.clientSpace.add(controller1);

    controller2 = world.renderer.xr.getController(1);
    controller2.addEventListener('selectstart', onSelectStart);
    controller2.addEventListener('selectend', onSelectEnd);
    controller2.addEventListener('connected', onConnect);
    controller2.addEventListener('disconnected', onRemove);
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
    const clientSpace = new THREE.Group();
    clientSpace.position.x = x;
    clientSpace.position.z = y;
    clientSpace.rotation.y = angle;    
  
    clientSpace.add(world.camera);
    world.camera.position.set(0, 1.5, 0);
    world.scene.add(clientSpace);   

    world.clientSpace = clientSpace;

    initializeControllers(world);

    let r = {material: new THREE.MeshLambertMaterial({color: 0xFF9900})};    
}

const replicas = {};

function createHand(world, r, side) {
    const hand = new THREE.Group();

    const palm = new THREE.Mesh(world.primitiveGeo.box, r.material);
    palm.scale.set(0.08, 0.02, 0.16);
    hand.add(palm);

    palm.rotation.set(0.3, 0, side * -1);
    palm.position.set(side * 0.02, 0, 0.05);

    const thumb = new THREE.Mesh(world.primitiveGeo.box, r.material);
    thumb.scale.set(0.02, 0.02, 0.08);
    hand.add(thumb);

    thumb.rotation.set(0, side * 0.5, 0);
    thumb.position.set(side * -0.02, 0.02, 0.08);

    world.scene.add(hand);

    return hand;
}

function createReplica(world, user) {
    //console.log(`creating replica for user ${user.id}:`, user);

    let rgb = user.user.rgb;
    const r = {
        material: rgb ? new THREE.MeshLambertMaterial({
                color: new THREE.Color(rgb), //new THREE.Color(`rgb(${Math.round(255 * rgb[0])}, ${Math.round(255 * rgb[1])},${Math.round(255 * rgb[2])})`)
            }) : world.defaultMaterial,
        hands: [undefined, undefined]
    }
    r.head = new THREE.Mesh(world.primitiveGeo.box, r.material);
    r.head.scale.set(0.2, 0.1, 0.12);

    const ball = new THREE.Mesh(world.primitiveGeo.sphere, r.material);    
    r.head.add (ball);
    ball.scale.set(1.2, 3.5, 2);
    ball.position.set(0, -0.52, 0.75);
    ball.castShadow = true;
    world.scene.add(r.head);

    r.body = new THREE.Mesh(world.primitiveGeo.box, r.material);
    r.body.scale.set(0.35, 0.65, 0.12);
    r.body.castShadow = true;
    world.scene.add(r.body);

    replicas[user.id] = r;

    r.nameGeo = new THREE.TextGeometry(user.user.name, {font:font, size: 0.3, height: 0});
    r.nameGeo.computeBoundingBox();
    const name = new THREE.Mesh(r.nameGeo, textMaterial);

    name.rotation.set(0, Math.PI, 0);

    name.position.addScaledVector(r.nameGeo.boundingBox.min, -0.5);
    name.position.addScaledVector(r.nameGeo.boundingBox.max, -0.5);
    name.position.y += 1.5;
    name.position.x *= -1.0;
    r.body.add(name);

    return r;
}

function tryReplicateHand(world, r, index, pos, quat) {
    let hand = r.hands[index];
    if (pos) {           
        if (!hand) {
            r.hands[index] = hand = createHand(world, r, index * 2 - 1);
        } else if (!hand.parent) {
            world.scene.add(hand);
        }

        hand.position.set(pos[0], pos[1], pos[2]);
        hand.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    } else if (hand && hand.parent) {        
        world.scene.remove(hand);
    }
}

let i = 0;
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

    if (controller1.children.length > 0) {    
        controller1.getWorldPosition(p);
        self.posL = [p.x, p.y, p.z];
        controller1.getWorldQuaternion(q);
        self.quatL = [q.x, q.y, q.z, q.w];
    } else if (self.posL) {        
        delete self.posL;
        delete self.quatL;
    }

    if (controller2.children.length > 0) {
        controller2.getWorldPosition(p);
        self.posR = [p.x, p.y, p.z];
        controller2.getWorldQuaternion(q);
        self.quatR = [q.x, q.y, q.z, q.w];
    } else if (self.posR) {
        delete self.posR;
        delete self.quatR;
    }


    if (++i >= 30) {
        i = 0;
        //console.log(self);
    }


    let forward = new THREE.Vector3(0, 0, -1);

    others.forEach((o) => {
        if (!o.user.rgb) return;

        let r = replicas[o.id];

        if (r === undefined) {
            r = createReplica(world, o);            
        }

        r.head.position.set(o.pos[0], o.pos[1], o.pos[2]);
        r.head.quaternion.set(o.quat[0], o.quat[1], o.quat[2], o.quat[3]);

        tryReplicateHand(world, r, 0, o.posL, o.quatL);
        tryReplicateHand(world, r, 1, o.posR, o.quatR);

        // Position body under head.
        p.set(0, 0, -1).applyQuaternion(r.head.quaternion).setComponent(1, 0).normalize();
        q.setFromUnitVectors(forward, p);        

        r.head.children[0].getWorldPosition(r.body.position);
        r.body.position.y -= 0.6;
        r.body.position.addScaledVector(p, -0.1);
        r.body.quaternion.slerp(q, 0.01);


        r.lastUpdate = t;
    });


    for (let key in replicas) {
        let r = replicas[key];
        if (r.lastUpdate < t) {
            //console.log(`Removing replica for ${key}`, r);            
            world.scene.remove(r.head);
            world.scene.remove(r.body);
            for (let i = 0; i < 2; i++) {
                if (r.hands[i] && r.hands[i].parent)
                    world.scene.remove(r.hands[i]);
            }
            if (r.material !== world.defaultMaterial)
                r.material.dispose();
            r.nameGeo.dispose();
            delete replicas[key];
        }
    }
}

export { setupLocalUser, updateReplicas };