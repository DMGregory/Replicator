// Responsible for reading poses received from the server,
// creating and animating matching avatars for remote users,
// and sharing this user's pose with the server.

// This also handles rendering the local client's controllers for them to see.
// TODO: That's a distinct responsibility that should be separated.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.126.0/build/three.module.js';
import { XRControllerModelFactory } from "https://cdn.jsdelivr.net/npm/three@0.126.0/examples/jsm/webxr/XRControllerModelFactory.min.js"; 

// Load a font that we can use to display user names of other users, 
// and prepare a material to use for text rendering.
const loader = new THREE.FontLoader();
let font;
loader.load('fonts/Roboto_Regular.json', function ( loadedFont) {
    font = loadedFont;
});
const textMaterial = new THREE.MeshBasicMaterial({color:0x000000});

// Keep a set of objects storing information about remote users, and the assets
// used to render their avatars locally.
const replicas = {};

// Add a "client-local" coordinate space into the world scene. This will represent the
// portion of the user's physical environment mapped into the VR space, and can be
// moved/rotated to teleport around the virtual scene.

// Accepts an x and y position in the world, and an angle in radians for the default facing direction
// so that we can set the initial positions/orientations of users to not overlap each other.
// Also accepts a "world" object (see world.js) with core components of the THREE.js scene.
function setupLocalUser(x, y, angle, world) {
    const clientSpace = new THREE.Group();
    clientSpace.position.x = x;
    clientSpace.position.z = y;
    clientSpace.rotation.y = angle;    
  
    // Place the user's camera (head) into this space so it moves with them
    // as we teleport around.
    clientSpace.add(world.camera);
    world.camera.position.set(0, 1.5, 0);
    world.scene.add(clientSpace);   

    // Save the client space in the common world object,
    // so it can be used by other modules that need it.
    // TODO: Maybe creating a clientSpace should be the world's responsibility,
    // and replication should be a consumer of this existing global object.
    world.clientSpace = clientSpace;

    // Set up handling for tracking controllers.
    initializeControllers(world);
}

// Controller handling adapted from WebXR BallShooter example:
// https://github.com/mrdoob/three.js/blob/master/examples/webxr_vr_ballshooter.html
let controller1, controller2, controllerGrip1, controllerGrip2;

// Constructs visible versions of controllers matching the user's hardware when they're activated.
// Accepts a "world" object (see world.js) to be able to add these visuals to the right part of the scene.
function initializeControllers(world) {
    // Tracking controller state changes.
    function onSelectStart() {
        this.userData.isSelecting = true;
    }

    function onSelectEnd() {
        this.userData.isSelecting = false;
    }

    function onConnect(event) {
        this.add(buildController(event.data));
    }

    // Added this function to ensure we don't leak memory when repeatedly adding
    // and removing controllers, piling up unused geometry/materials for the selection pointer child.
    function onRemove() {
        let child = this.children[0];
        if (child) {
            this.remove(child);
            child.geometry.dispose();
            child.material.dispose();
        }
    }

    // Wire up left and reight controllers, and add them to the user's local coordinate space
    // so they follow as we teleport around the scene.
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

    // Load appropriate display model into the "grip" group for each controller,
    // and add them to the user's local coordinate space so they follow as we teleport.
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

// Set up pointer visuals to match the kind of interaction used by this controller.
// Accepts a data object from an XR Controller "connected" event to match the detected hardware.
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


// Creates a THREE.Group containing meshes that approximate a hand.
// Takes a "world" object so it can use common primitives and add the object to the scene,
// a "replica" object so it can access the right coloured material for this avatar,
// and a "side" number that is -1 for the left hand, and 1 for the right hand,
// controlling mirroring of the visible shape.
function createHand(world, replica, side) {
    const hand = new THREE.Group();

    const palm = new THREE.Mesh(world.primitiveGeo.box, replica.material);
    palm.scale.set(0.08, 0.02, 0.16);
    palm.rotation.set(0.3, 0, side * -1);
    palm.position.set(side * 0.02, 0, 0.05);
    hand.add(palm);

    const thumb = new THREE.Mesh(world.primitiveGeo.box, replica.material);
    thumb.scale.set(0.02, 0.02, 0.08);
    thumb.rotation.set(0, side * 0.5, 0);
    thumb.position.set(side * -0.02, 0.02, 0.08);
    hand.add(thumb);    

    world.scene.add(hand);

    return hand;
}

// Creates an avatar representing a remote user.
// Takes a "world" object to use common primitives and to add the avatar to the scene,
// and a "user" object "otherUser" with the latest information about this remote client from the server.
function createReplica(world, otherUser) {

    // Read the custom user data belonging to the user to choose an appropriate colour.
    // This will be used with a material shared by all the replica's parts.
    let rgb = otherUser.user.rgb;
    const replica = {
        material: rgb ? new THREE.MeshLambertMaterial({color: new THREE.Color(rgb)})
                      : world.defaultMaterial,
        hands: [undefined, undefined]
    }
    // Build a "head" object, starting with a box representing the user's VR goggles.
    replica.head = new THREE.Mesh(world.primitiveGeo.box, replica.material);
    replica.head.scale.set(0.2, 0.1, 0.12);

    // Add to the box a sphere to create a sense of a head/face behind the goggles,
    // and help clarify which direction the goggles are pointing.
    const ball = new THREE.Mesh(world.primitiveGeo.sphere, replica.material);    
    replica.head.add (ball);
    ball.scale.set(1.2, 3.5, 2);
    ball.position.set(0, -0.52, 0.75);
    ball.castShadow = true;
    world.scene.add(replica.head);

    // Create a box to serve as the torso.
    replica.body = new THREE.Mesh(world.primitiveGeo.box, replica.material);
    replica.body.scale.set(0.35, 0.65, 0.12);
    replica.body.castShadow = true;
    world.scene.add(replica.body);

    // Create text to show the user's display name.
    replica.nameGeo = new THREE.TextGeometry(otherUser.user.name, {font:font, size: 0.3, height: 0});
    replica.nameGeo.computeBoundingBox();
    const name = new THREE.Mesh(replica.nameGeo, textMaterial);
    name.rotation.set(0, Math.PI, 0);
    // Position the name so it hovers above the body, centered left-to-right.
    name.position.addScaledVector(replica.nameGeo.boundingBox.min, -0.5);
    name.position.addScaledVector(replica.nameGeo.boundingBox.max, -0.5);
    name.position.y += 1.5;
    name.position.x *= -1.0;
    replica.body.add(name);

    // Add the replica object to our master list of replicated client avatars.
    replicas[otherUser.id] = replica;
    return replica;
}

// If pose information was received for this avatar's hand,
// create/update the displayed hand to match. Otherwise, hide the displayed hand.
// Takes a world object to add/remove the hand from the scene,
// a replica object that stores the hand display objects for that avatar, and their material,
// an index for which hand to try to update, 0 = left or 1 = right,
// and a position and quaternion arrays received from the server (or undefined if no data as received)
function tryReplicateHand(world, replica, index, pos, quat) {
    // Look up the corresponding hand display object from this avatar.
    let hand = replica.hands[index];

    
    if (pos) {           
        // If we have position data for this hand, display and update it.
        if (!hand) {
            // If we haven't made this hand yet for this avatar, make one "just in time".
            let side = index * 2 - 1; // -1 = left, +1 = right to mirror the displayed shape.
            replica.hands[index] = hand = createHand(world, replica, side);
        } else if (!hand.parent) {
            // Otherwise, if we'd hidden the hand, un-hide it.
            world.scene.add(hand);
        }

        // Update the hand group's pose with the new server data.
        hand.position.set(pos[0], pos[1], pos[2]);
        hand.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    } else if (hand && hand.parent) {        
        // Otherwise, if we stopped getting hand pose data,
        // and we're currently showing a hand we made earlier, hide it.
        world.scene.remove(hand);
    }
}

// The main workhorse. This does the work of saving our current pose to be sent to the server,
// and updating the displayed avatars of remote users based on the latest server data.
// It takes a "world" object for any scene interactions, and two objects from connect.js:
// "self" containing data about the local user to sync to the server,
// and "others", a set of remote user data received from the server.
function updateReplicas(world, self, others) {

    // Save the user's view position and orientation in world space
    // into the data structure that's periodically sent to the server.
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

    // For any controllers that are active (and thus have a pointer child attached),
    // include their data in the object to be sent to the server too.
    // Otherwise, prune any old data from when they were last active.
    if (controller1.children.length > 0) {    
        controller1.getWorldPosition(p);
        self.posL = [p.x, p.y, p.z];
        controller1.getWorldQuaternion(q);
        self.quatL = [q.x, q.y, q.z, q.w];
    } else if (self.posL) {        
        self.posL = undefined;
        self.quatL = undefined;
    }

    if (controller2.children.length > 0) {
        controller2.getWorldPosition(p);
        self.posR = [p.x, p.y, p.z];
        controller2.getWorldQuaternion(q);
        self.quatR = [q.x, q.y, q.z, q.w];
    } else if (self.posR) {
        self.posR = undefined;
        self.quatR = undefined;
    }


    // Get time stamp to distinguish replicas we've updated from those we haven't.
    const currentTime = world.clock.getElapsedTime();
    const forward = new THREE.Vector3(0, 0, -1);

    // Iterate over all remote clients' data and update their displayed avatars.
    others.forEach((other) => {
        // We may get an update about a newly-connected user before they've had
        // a chance to tell the server their display name and colour.
        // Wait for complete info before building their avatar.

        // TODO: handle "new user join" as a separate message, so we don't have to scan
        // for new folks in our update tick.
        if (!other.user.rgb) return;

        // Fetch or create the object containing the avatar assets for this user.
        let replica = replicas[other.id];
        if (replica === undefined) {
            replica = createReplica(world, other);            
        }

        // Update the replicated avatar's head pose.
        replica.head.position.set(other.pos[0], other.pos[1], other.pos[2]);
        replica.head.quaternion.set(other.quat[0], other.quat[1], other.quat[2], other.quat[3]);

        // And hand poses, if we received hand data from the server.
        tryReplicateHand(world, replica, 0, other.posL, other.quatL);
        tryReplicateHand(world, replica, 1, other.posR, other.quatR);

        // Position the torso under the head and slightly behind.
        // First, create an offset vector from the head pose, pointing toward the back of the head,
        // flatten it into the horizontal plane, and scale it to unit length.
        p.set(0, 0, -1).applyQuaternion(replica.head.quaternion).setComponent(1, 0).normalize();
        // Use this to smoothly rotate the torso, so it stays upright while facing roughly in the gaze direction. 
        q.setFromUnitVectors(forward, p);        
        replica.body.quaternion.slerp(q, 0.01);

        // Shift the body down and back from the head position, using the offset vector from earlier.
        replica.head.children[0].getWorldPosition(replica.body.position);
        replica.body.position.y -= 0.6;
        replica.body.position.addScaledVector(p, -0.1);
        
        // Mark this replica as updated this frame.
        replica.lastUpdate = currentTime;
    });


    // Iterate over all replicas to find any that were not updated this frame,
    // meaning the user they represent disconnected and does not appear in the server's update message.
    // Destroy the avatars for these absent users.
    // TODO: Implement a "user leave" message from the server to handle this explicitly.
    for (let key in replicas) {
        let replica = replicas[key];
        if (replica.lastUpdate < currentTime) {            
            world.scene.remove(replica.head);
            world.scene.remove(replica.body);
            for (let i = 0; i < 2; i++) {
                if (replica.hands[i] && replica.hands[i].parent)
                    world.scene.remove(replica.hands[i]);
            }
            // Release any assets the replica was using that can't be garbage collected.
            if (replica.material !== world.defaultMaterial)
                replica.material.dispose();
            replica.nameGeo.dispose();
            delete replicas[key];
        }
    }
}

// Publish this module's API for use in the main app.
export { setupLocalUser, updateReplicas };