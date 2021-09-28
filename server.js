// Clones from https://github.com/worldmaking/nodelab/blob/main/server.js

/*
A simple server to manage user connections within different "rooms"
Server: I open a websocket server
Client: I connect to your websocket
Server: wss.on('connection') -- I create a UUID and client struct for you, set up my handlers, and tell you "handshake <id>"
Client: I receive your "handshake", and copy that to my local session ID
I reply with "handshake <id>" to confirm
I will now start listening for other messages
Server: I receive your "handshake" and I will now start listening for other messages
Should:
- ensure clients all have unique IDs (UUID)
	- new client connection generates new UUID on server & server informs client
	- wait for an ack back?
	- could be nice to resume old UUID if the break wasn't too long?
- ensure a client is in only one room at once
- notice when a client has disconnected, & remove it
	- this includes when client has not posted a request for a while?
- remove a room when nobody is in it
- receive pose updates from clients
- reply to these with the poses of other clients in the same room
- when a client enters or exits a room, update other clients in the same room
- when a client changes some self-state (e.g. colour), update other clients in the same room
- basically, forward all client changes to other clients in the same room
A relatively lazy way to do this would be to simply send a list of client states to all members of a room, but that would be wasteful of bandwidth when client states get more complex. 
Next laziest is to simply forward all client changes to other clients in the same room, adding the corresponding UUID. Change could be represented as a jsonpatch, but that would be wasteful for poses. Probably better to have a few commands.
To server:
- "enter <roomname>" (implicit exit)
- "pose <headpos array> <quat array>"
- "patch <jsonpatch>" for everything else
To clients:
- "enter <uuid>"
- "exit <uuid>"
- "pose <uuid> <headpos array> <quat array>"
- "patch <uuid> <jsonpatch>"
JSONPATCH:
- http://jsonpatchjs.com/ node and browser, does not mutate, 
- https://github.com/Starcounter-Jack/JSON-Patch can mutate or not, observers, diffs. ACTIVE. benchmarks show this to be fastest
- https://github.com/sonnyp/JSON8/tree/main/packages/patch mutates, can generate diffs, inversions, can compress patches. ACTIVE. spec shows this to be the most complete. 
*/

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

const clients = {}
// a set of uniquely-named rooms
// each room would have a list of its occupants
// a client can only be in one room at a time
const rooms = {
	
}

// get (or create) a room:
function getRoom(name="default") {
	if (!rooms[name]) {
		rooms[name] = {
			name: name,
			clients: {},
		}
	}
	return rooms[name]
}

function notifyRoom(roomname, msg) {
	let room = rooms[roomname]
	if (!room) return;
	let others = Object.values(room.clients)
	for (let mate of others) {
		mate.socket.send(msg)
	}
}

// generate a unique id if needed
// verify id is unused (or generate a new one instead)
// returns 128-bit UUID as a string:
function newID(id="") {
	while (!id || clients[id]) id = uuidv4()
	return id
}

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
const wss = new ws.Server({ server: server });


wss.on('connection', (socket, req) => {
	let room = url.parse(req.url).pathname.replace(/\/*$/, "").replace(/\/+/, "/")
	if (!room) room = "default"
	let id = newID()
	let client = {
		socket: socket,
		room: room,
		shared: {
			id: id,
			pos: [0, 0, 0],
			quat: [0, 0, 0, 1],
			user: {}
		}
	}
	clients[id] = client

	console.log(`client ${client.shared.id} connecting to room ${client.room}`);

	// enter this room
	getRoom(client.room).clients[id] = client

	socket.on('message', (data) => {		
		const msg = JSON.parse(data);
		switch(msg.cmd) {
			case "pose": 
				client.shared.pos = msg.pos;
				client.shared.quat = msg.quat;
				break;
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
		//console.log("close", id)
		//console.log(Object.keys(clients))
		delete clients[id];		

		// remove from room
		if (client.room) { 
			console.log(`client ${id} removed from room`)
			delete rooms[client.room].clients[id]
		} else {
			console.log(`client ${id} has no room`)
		}

		console.log(`client ${id} left`)
	});

	socket.send(JSON.stringify({cmd: "handshake", id: id}));
});

setInterval(function() {
	for (let roomid of Object.keys(rooms)) {
		const room = rooms[roomid]
		let clientlist = Object.values(room.clients)
		let shared = JSON.stringify({cmd: "others", others: clientlist.map(o=>o.shared)});
		clientlist.forEach(c => c.socket.send(shared))
	}
}, 1000/30);

server.listen(PORT, () => console.log(`Server listening on port: ${PORT}`));