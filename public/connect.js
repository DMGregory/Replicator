function connectToWorld(opt = {}) {
  let options = Object.assign(
    {
      url: 'wss://digm5520replicator.herokuapp.com',
      room: '/',
      reload_on_disconnect: false,

      log: console.log,
    },
    opt
  );

  console.log('options', options);

  let world = {
    self: {
      id: '',
      pos: [0, 0, 0],
      quat: [0, 0, 0, 1],
      user: {
        rgb: [Math.random(), Math.random(), Math.random()],
      },
    },
    others: [],
  };

  function connect(world) {
    options.log(`connecting to ${options.url}${options.room}`);
    server = new WebSocket(options.url + options.room);
    server.binaryType = 'arraybuffer';

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

    server.onerror = function (event, error) {
      options.log('WebSocket error observed:', event, error);
      server.close();
      reconnect();
    };

    server.onopen = () => {
      options.log(`connected to ${options.url}`);
      server.onclose = function (event) {
        options.log('disconnected');
        reconnect();
      };
      server.onmessage = (event) => {
        let msg = JSON.parse(event.data);
        switch (msg.cmd) {
          case 'handshake':
            world.self.id = msg.id;
            break;
          case 'others':
            world.others = msg.others.filter((o) => o.id != world.self.id);
            break;
          case 'reload':
            location.reload();
            break;
          default:
            options.log(msg);
        }
      };

      // send an update regarding our userdata:
      server.send(JSON.stringify({ cmd: 'user', user: world.self.user }));
    };

    return server;
  }

  server = connect(world);

  setInterval(() => {
    if (server && server.readyState == 1 && world.self.id) {
      server.send(
        JSON.stringify({
          cmd: 'pose',
          pos: world.self.pos,
          quat: world.self.quat,
        })
      );
    }
  }, 1000 / 30);

  return {
    world,
    server,
  };
}
