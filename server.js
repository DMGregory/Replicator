/*
  Douglas Gregory - 219033117

  See public/index.html for overview of whole solution.
  This code is responsible for running the Heroku server, serving the public html/js/css/asset files, 
  and operating a WebSocket connection to relay user data and poses to all connected clients, in one of potentially many "rooms".


  This file is only slightly modified from Graham Wakefield's https://github.com/worldmaking/nodelab/blob/main/public/connect.js

  The main changes were adding replicated fields for a user's controller poses and display name,
  and updating the message format to use pure JSON, rather than a string command followed by a JSON body.

  Small changes made to the handling of room names, due to a bug in handling an empty/invalid room name 
  (getRoom would return a valid room named "default", but the room variable would still hold the old name, causing the client to not be removed properly on exit)

  I've also added comments to document my understanding of the code.


  To use: to test locally, use the command "node server.js" or "nodemon server.js" from the command line, then point a browser at localhost:3000
  Or push this repository to a Heroku server to run it live online.

  Use connect.js's connectToWorld() function to establish a connection from the client web page to this server.
*/

/*
A simple server to manage user connections within different "rooms"
Server: I open a websocket server
Client: I connect to your websocket
Server: wss.on('connection') -- I create a UUID and client struct for you, set up my handlers, and tell you "handshake <id>"
Client: I receive your "handshake", and copy that to my local session ID
I reply with {cmd: "user", user: { name: "display name here", rgb: #0DDB0B}}" to confirm, and tell you how others should display me.
I will now start listening for other messages.
Server: I receive your "user" command and I will now start listening for other messages.
*/

// Configure dependencies for HTTP server and WebSocket server.
const path = require("path")
const fs = require('fs');
const url = require('url');
const http = require('http');
const assert = require("assert");

const ws = require('ws');
const express = require("express");
const { v4: uuidv4 } = require("uuid")
const jsonpatch = require("json8-patch");
const { exit } = require("process");

const PORT = process.env.PORT || 3000;
const app = express();
// allow cross-domain access:
app.use(function(req, res, next) {
	res.header('Access-Control-Allow-Origin', '*');
	res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type');
	return next();
});
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app)


// A set of uniquely-named rooms.
// Each room would have a list of its occupants
// a client can only be in one room at a time.
const rooms = {}

// Master set of users actively connected via WebSocket,
// referencing client objects from all rooms.
// Used to ensure IDs remain unique server-wide.
const clients = {}

// Get (or create) a room:
function getRoom(name="default") {
	if (!rooms[name]) {
		rooms[name] = {
			name: name,
			clients: {},
		}
	}
	return rooms[name]
}

// Send a message to all users in a specific room.
function notifyRoom(roomname, msg) {
	let room = rooms[roomname]
	if (!room) return;
	let others = Object.values(room.clients)
	for (let mate of others) {
		mate.socket.send(msg)
	}
}

// Generate a unique id if needed
// verify id is unused (or generate a new one instead)
// returns 128-bit UUID as a string:
function newID(id="") {
	while (!id || clients[id]) id = uuidv4()
	return id
}

// Set up WebSocket server.
const wss = new ws.Server({ server: server });

// Handle incoming connections as a new user joining a room.
wss.on('connection', (socket, req) => {
	// Read the path from the connection request and treat it as a room name, sanitizing and standardizing the format.
	// Actual room name might differ from this, if it's empty and we need to substitute a "default" instead.
	let requestedRoomName = url.parse(req.url).pathname.replace(/\/*$/, "").replace(/\/+/, "/")

	// Create a data structure to hold information about this client. 
	let client = {
		socket: socket,
		// Changed this to reference the room directly, so there can never be a mismatch between the name
		// the client gives their room, and the room's actual name. Also lets us access the room without a name lookup.
		room: getRoom(requestedRoomName),
		shared: {
			id: newID(),
			pos: [0, 0, 0],			// Head location.
			quat: [0, 0, 0, 1],		// Head orientation.
			user: { }				// Custom data (display name, colour).
		}
	}
	// Add this client to the master client list, and the room-specific list.
	clients[client.shared.id] = client;
	client.room.clients[client.shared.id] = client

	console.log(`client ${client.shared.id} connecting to room ${client.room.name}`);

	// Handle incoming commands from this user.
	socket.on('message', (data) => {		
		const msg = JSON.parse(data);
		switch(msg.cmd) {
			// Update the user's head, and optionally controller positions and orientations.
			case "pose": 
				client.shared.pos = msg.pos;
				client.shared.quat = msg.quat;
				if (msg.posL) {	
					// Controller pose information is optional. Use it if it's present.
					// (Left controller position & orientation).
					client.shared.posL = msg.posL;
					client.shared.quatL = msg.quatL;
				} else if (client.shared.posL) {
					// If the client stops sending controller updates, remove that controller
					// so it's no longer replicated to other clients.
					client.shared.posL = undefined;
					client.shared.quatL = undefined;
				}
				// Repeat for right-hand controller.
				if (msg.posR) {
					client.shared.posR = msg.posR;
					client.shared.quatR = msg.quatR;
				} else if (client.shared.posR) {
					client.shared.posR = undefined;
					client.shared.quatR = undefined;
				}
				break;
			// Handle changes to the user's custom data. Sent as part of the connection handshake
			// to establish user display name and colour.
			// TODO: broadcast this info to other clients only when it changes, not in every pose update.
			case "user": 
				client.shared.user = msg.user;
				break;
		}
	});

	socket.on('error', (err) => {
		console.log(err)
		// should we exit?
	});

	socket.on('close', () => {
		// Remove from room.
		console.log(`client ${client.shared.id} removed from room`)
		delete client.room.clients[client.shared.id];

		// Remove from master client list.
		delete clients[client.shared.id];
	});

	socket.send(JSON.stringify({cmd: "handshake", id: client.shared.id}));
});

// 30 times per second, tell everyone in the room the pose and user data of everyone else in that room.
setInterval(function() {
	for (let roomid of Object.keys(rooms)) {
		const room = rooms[roomid]
		let clientlist = Object.values(room.clients)
		let shared = JSON.stringify({cmd: "others", others: clientlist.map(o=>o.shared)});
		clientlist.forEach(c => c.socket.send(shared))
	}
}, 1000/30);

// Everything is ready. Start listening for connections.
server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));