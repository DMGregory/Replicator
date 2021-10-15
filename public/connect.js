//
/*
Establishes a connection to the WebSocket server, and returns a pair {world, server}

world contains:
 - a self object, with the data about the local client to sync to the server periodically,
 - an others array, containing a list of other users' states received from the server periodically.

server is a reference to the WebSocket connection.

connectToWorld accepts an options object with the url to connect to,
the name of the room to join, the user's display name and colour, 
a logging function to call, and a flag to control whether to reload when disconnected.

All of these parameters are optional, and defaults will be substituted for any that are absent.
*/ 
function connectToWorld(opt = {}) {
  // Substitute defaults for any parameters not set by the caller.
  let options = Object.assign(
    {
      url: 'wss://digm5520replicator.herokuapp.com',
      room: '/',
      reload_on_disconnect: false,
      userName: "Anonymous",
      userColour: 0x6495ED,
      log: console.log,
    },
    opt
  );

  // Create our world object, with a self field representing the local client's info,
  // and an others array to hold information about remote users received from the server.
  let world = {
    self: {
      id: '',
      pos: [0, 0, 0],     // Viewpoint/HMD position in world space.
      quat: [0, 0, 0, 1], // Viewpoint/HMD orientation in world space.
      user: {             // Custom user data. Currently used for display name & colour.
        name: options.userName,
        rgb: options.userColour,
      },
    },
    others: [],
  };

  // Sets up WebSocket connection to the server, and handling of the various commands.
  function connect(world) {

    options.log(`connecting to ${options.url}${options.room}`);
    server = new WebSocket(options.url + options.room);
    server.binaryType = 'arraybuffer';

    // Handle reconnecting/reloading in the event of an error.
    reconnect = function () {
      server = null;
      setTimeout(() => {
        if (options.reload_on_disconnect) {
          location.reload();
        } else {
          if (!server) connect(world);
        }
      }, 3000);
    };

    server.onerror = function (event) {
      options.log('WebSocket error observed:', event);
      server.close();
      reconnect();
    };

    // When a connection is established, set up message handling, and introduce
    // ourselves with our display name / colour to show to other users.
    server.onopen = () => {
      options.log(`connected to ${options.url}`);
      server.onclose = function (event) {
        options.log('disconnected');
        reconnect();
      };

      // When we receive a message from the server, parse it as JSON 
      // and handle each possible value of the "cmd" field.
      server.onmessage = (event) => {
        let msg = JSON.parse(event.data);
        switch (msg.cmd) {
          case 'handshake':
            // Sent after first connection - tells us our own unique ID.
            world.self.id = msg.id;
            break;
          case 'others':
            // Sent 30 times per second, giving us everyone's updated poses & states.
            // TODO: Do this filtering server-side, so we don't send people their own data?
            world.others = msg.others.filter((o) => o.id != world.self.id);
            break;
          case 'reload':
            // Currently unused, but could help recover from an invalid state.
            location.reload();
            break;
          default:
            // Log unknown messages.
            options.log("unknown message", msg);
        }
      };

      // Introduce ourselves to the server with our display name & colour.
      server.send(JSON.stringify({ cmd: 'user', user: world.self.user }));
    };

    return server;
  }

  // Initiate connection.
  server = connect(world);

  // 30 times per second, send our latest pose information to the server.
  setInterval(() => {
    // Skip sending if the server is not ready or our arrival has not yet
    // been confirmed by issuing us an ID.
    if (server && server.readyState == 1 && world.self.id) {

      // Send a "pose" message with the worldspace position & orientation of our HMD/view.
      const message = {
        cmd: 'pose',
        pos: world.self.pos,
        quat: world.self.quat,
      };

      // If hand controllers have been detected, replication.js will write their
      // position and orientations in worldspace here (L = Left, R = Right),
      // so we just relay that to the server.
      if (world.self.posL) {        
        message.posL = world.self.posL;
        message.quatL = world.self.quatL;
      }
      if (world.self.posR) {
        message.posR = world.self.posR;
        message.quatR = world.self.quatR;
      }

      // Fire the message off.
      server.send(JSON.stringify(message));
    }
  }, 1000 / 30);

  // Return references to be able to read/populate the synchronized data,
  // and operate the WebSocket server.
  return {
    world,
    server,
  };
}
