module.exports = function (RED) {

  const { sp108eDevice } = require('../../lib/sp108e_core');
  const { animNames } = require('../../lib/sp108e_core');
  const { orderNames } = require('../../lib/sp108e_core');
  const { chipNames } = require('../../lib/sp108e_core');

  const validateCommand = (command) => {
      let res = { valid: true, msg: [] };
      for (var c of Object.getOwnPropertyNames(command)) {
        switch (c) {
          case 'state':
            if (!/^(on|off)$/.test(command.state)) {
              res.valid = false;
              res.msg.push('Value of "state" must be "on" or "off"');
            }

          break;
          case 'animation':
            if (command.animation.hasOwnProperty('mono')) {
              //meteor|breathing|stack|flow|wave|flash|static|catchup
              if (!animNames.hasOwnProperty(command.animation.mono)) {
                res.valid = false;
                res.msg.push('Value of "animation.mono" is incorrect. See manual for possible values');
              }
            } else if (command.animation.hasOwnProperty('mixed')) {
              if (!/^(auto|[1-9]|[1-9]\d|1[0-7]\d|180)$/.test(command.animation.mixed)) {
                res.valid = false;
                res.msg.push('Value of "animation.mixed" must be "auto" or integer (1-180)');
              }
            } else {
              res.valid = false;
              res.msg.push('Value of "animation" must be "mono" or "mixed"');
            }

          break;
          case 'brightness':
            if (!/^([1-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(command.brightness)) {
              res.valid = false;
              res.msg.push('Value of "brightness" must be integer (1-255)');
            }

          break;
          case 'color':
            if (!/^#[0-9a-fA-F]{6}$/.test(command.color)) {
              res.valid = false;
              res.msg.push('Value of "color" must be hex value like "#ffffff"');
            }

          break;
          case 'speed':
            if (!/^([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(command.speed)) {
              res.valid = false;
              res.msg.push('Value of "speed" must be integer (0-255)');
            }

          break;
          case 'white':
            if (!/^([0-9]|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])$/.test(command.white)) {
              res.valid = false;
              res.msg.push('Value of "white" must be integer (0-255)');
            }

          break;
          case 'colorOrder':
            if (!orderNames.hasOwnProperty(command.colorOrder)) {
              res.valid = false;
              res.msg.push('Value of "colorOrder" is incorrect. See manual for possible values');
            }

          break;
          case 'icType':
            if (!chipNames.hasOwnProperty(command.icType)) {
              res.valid = false;
              res.msg.push('Value of "icType" is incorrect. See manual for possible values');
            }

          break;
          case 'ledsPerSegment':
            if (!/^([1-9]|[1-9]\d|[1-2]\d\d|300)$/.test(command.ledsPerSegment)) {
              res.valid = false;
              res.msg.push('Value of "ledsPerSegment" must be integer (1-300)');
            }

          break;
          case 'numberOfSegments':
            if (!/^([1-9]|[1-9]\d|[1-2]\d\d|300)$/.test(command.numberOfSegments)) {
              res.valid = false;
              res.msg.push('Value of "numberOfSegments" must be integer (1-300)');
            }

          break;
          default:
            res.valid = false;
            res.msg.push('Undefined command "' + c + '"');
          break;
        }
      }

      if (!res.msg.length) delete res.msg;

      return res;
    };

  const performCommmand = async(node, send, done, device, command, returnStatus, debug) => {
      send = send || function () { node.send.apply(node, arguments); };

      var msg = {};
      var status;
      try {
        if (validateCommand(command).valid) {
          let deviceConfig = {};
          deviceConfig.host = device.host;
          deviceConfig.port = device.port;
          let p = new sp108eDevice(deviceConfig);
          p.log = (msg) => { if (debug) { node.warn(msg); } else {} };

          node.status({ fill: 'yellow', shape: 'dot', text: 'Sending' });

          if (command.hasOwnProperty('state')) {
            switch (command.state) {
              case 'on':
                status = await p.on();
              break;
              case 'off':
                status = await p.off();
              break;
            }
          }

          if (command.hasOwnProperty('animation')) {
            if (command.animation.hasOwnProperty('mono')) {
              status = await p.setMonoColorAnimation(command.animation.mono);
            }

            if (command.animation.hasOwnProperty('mixed')) {
              status = await p.setMixedColorAnimation(command.animation.mixed);
            }

          }

          if (command.hasOwnProperty('brightness')) {
            await p.setBrightness(command.brightness);
          }

          if (command.hasOwnProperty('white')) {
            await p.setWhiteValue(command.white == 255 ? 0 : command.white + 1);
          }

          if (command.hasOwnProperty('speed')) {
            await p.setAnimationSpeed(command.speed);
          }

          if (command.hasOwnProperty('color')) {
            await p.setColor(command.color.slice(1));
          }

          if (command.hasOwnProperty('colorOrder')) {
            await p.setColorOrder(command.colorOrder);
          }

          if (command.hasOwnProperty('icType')) {
            await p.setChipType(command.icType);
          }

          if (command.hasOwnProperty('ledsPerSegment')) {
            await p.setLedsPerSegments(command.ledsPerSegment);
          }

          if (command.hasOwnProperty('numberOfSegments')) {
            await p.setNumberOfSegments(command.numberOfSegments);
          }

          if (returnStatus) {
            msg.payload = status || await p.getStatus();
          } else {
            msg.payload = 'OK';
          }

          node.status({ fill: 'green', shape: 'dot', text: 'OK' });
          setTimeout(() => { node.status({}); }, 1000);
        } else {
          msg.payload = 'ERROR';
          node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
          node.error('Command validation error!');
        }
      } catch (e) {
        msg.payload = 'ERROR';
        node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
        node.error(e.message);
      }

      send(msg);
      if (done) {
        done();
      }
    };

  const getDeviceStatus = async(node, send, done, device, debug) => {
      send = send || function () { node.send.apply(node, arguments); };

      var msg = {};
      try {
        let deviceConfig = {};
        deviceConfig.host = device.host;
        deviceConfig.port = device.port;
        let p = new sp108eDevice(deviceConfig);
        p.log = (msg) => { if (debug) { node.warn(msg); } else {} };
        node.status({ fill: 'yellow', shape: 'dot', text: 'sending' });
        msg.payload = await p.getStatus();
        node.status({ fill: 'green', shape: 'dot', text: 'OK' });
        setTimeout(() => { node.status({}); }, 1000);
      } catch (e) {
        msg.payload = 'ERROR';
        node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
        node.error(e.message);
      }

      send(msg);
      if (done) {
        done();
      }
    };

  const getDeviceName = async(node, send, done, device, debug) => {
      send = send || function () { node.send.apply(node, arguments); };

      var msg = {};
      try {
        let deviceConfig = {};
        deviceConfig.host = device.host;
        deviceConfig.port = device.port;
        let p = new sp108eDevice(deviceConfig);
        p.log = (msg) => { if (debug) { node.warn(msg); } else {} };
        node.status({ fill: 'yellow', shape: 'dot', text: 'sending' });
        msg.payload = await p.getDeviceName();
        if (msg.payload.indexOf('SP108E_') == 1) {
          msg.payload = msg.payload.slice(8);
        }

        node.status({ fill: 'green', shape: 'dot', text: 'OK' });
        setTimeout(() => { node.status({}); }, 1000);
      } catch (e) {
        msg.payload = 'ERROR';
        node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
        node.error(e.message);
      }

      send(msg);
      if (done) {
        done();
      }
    };

  const setDeviceName = async(node, send, done, device, name, debug) => {
      send = send || function () { node.send.apply(node, arguments); };

      var msg = {};
      var status;
      try {
        if ((name) && (/^[-a-zA-Z0-9_]{1,10}$/.test(name))) {
          let deviceConfig = {};
          deviceConfig.host = device.host;
          deviceConfig.port = device.port;
          let p = new sp108eDevice(deviceConfig);
          p.log = (msg) => { if (debug) { node.warn(msg); } else {} };
          node.status({ fill: 'yellow', shape: 'dot', text: 'Sending' });
          await p.setDeviceName(name);
          node.status({ fill: 'green', shape: 'dot', text: 'OK' });
          setTimeout(() => { node.status({}); }, 1000);
        } else {
          msg.payload = 'ERROR';
          node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
          node.error('Device name must be 10 chars (-a-zA-Z0-9_) max!');
        }
      } catch (e) {
        msg.payload = 'ERROR';
        node.status({ fill: 'red', shape: 'ring', text: 'ERROR' });
        node.error(e.message);
      }

      send(msg);
      if (done) {
        done();
      }
    };

  function Sp108eCommandNode(config) {
    RED.nodes.createNode(this, config);
    var spNode = this;

    spNode.device = RED.nodes.getNode(config.device);
    spNode.mode = config.mode;
    spNode.command = config.command;
    spNode.returnStatus = config.returnStatus;
    spNode.debug = config.debug;

    this.on('input', function (msg, send, done) {
      if (spNode.device) {
        switch (spNode.mode) {
          case 'json':
            performCommmand(spNode, send, done, spNode.device, msg.payload,
              spNode.returnStatus, spNode.debug);
          break;
          case 'status':
            getDeviceStatus(spNode, send, done, spNode.device, spNode.debug);
          break;
          case 'getname':
            getDeviceName(spNode, send, done, spNode.device, spNode.debug);
          break;
          case 'setname':
            setDeviceName(spNode, send, done, spNode.device, msg.payload, spNode.debug);
          break;
          default:
            performCommmand(spNode, send, done, spNode.device, spNode.command,
              spNode.returnStatus, spNode.debug);
          break;
        }
      }
    });
  }

  RED.nodes.registerType('sp108eCommand', Sp108eCommandNode);
};
