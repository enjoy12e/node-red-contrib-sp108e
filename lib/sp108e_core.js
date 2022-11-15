// Based on https://github.com/Lehkeda/SP108E_controller for PHP

const net = require('net');
const { PromiseSocket } = require('promise-socket');

// Device-dependent constants for sp108e modules

const CMD_GET_NAME = '77';
const CMD_GET_STATUS = '10';
const CMD_PREFIX = '38';
const CMD_SUFFIX = '83';
const CMD_TOGGLE = 'aa';
const CMD_SET_BRIGHTNESS = '2a'; //00-FF
const CMD_SET_COLOR = '22'; //000000-FFFFFF
const CMD_SET_SPEED = '03'; //00-FF
const CMD_SET_WHITE = '08'; //00-FF
const CMD_SET_ANIMATION_MODE = '2c';
const CMD_SET_MIXED_COLOR_AUTO = '06';
const CMD_SET_REC_ANIM_MODE = 'db'; /*not work yet!!*/

const CMD_SET_DEVICE_NAME = '14';
const CMD_SET_LEDS_PER_SEGMENT = '2d';
const CMD_SET_SEGMENT_NUMBER = '2e';
const CMD_SET_CHIP_TYPE = '1c';
const CMD_SET_COLOR_ORDER = '3c';

const NULL_PARAM = '000000';
const WAIT_DURATION = 250;

function printDebugMsg(msg) {
  console.log(msg);
}

function protectWait() {
  return new Promise((resolve) => setTimeout(resolve, WAIT_DURATION));
}

function intToHex(int) {
  return int.toString(16).padStart(2, '0');
}

function doubleSidedDict(srcDict) {
  var res = Object.assign({}, srcDict);
  for (var k in srcDict) {
    res[srcDict[k]] = k;
  }

  return res;
}

function reverseSidedDict(srcDict) {
  var res = {};
  for (var k in srcDict) {
    res[srcDict[k]] = k;
  }

  return res;
}

var chipNames = { SM16703: '00', TM1804: '01', UCS1903: '02', WS2811: '03',
  WS2801: '04', SK6812: '05', LPD6803: '06', LPD8806: '07', APA102: '08',
  APA105: '09', DMX512: '0a', TM1914: '0b', TM1913: '0c', P9813: '0d',
  INK1003: '0e', P943S: '0f', P9411: '10', P9413: '11', TX1812: '12',
  TX1813: '13', GS8206: '14', GS8208: '15', SK9822: '16', TM1814: '17',
  SK6812_RGBW: '18', P9414: '19', P9412: '1a', };

var chipCodes = reverseSidedDict(chipNames);

var orderNames = { RGB: '00', RBG: '01', GRB: '02',
  GBR: '03', BRG: '04', BGR: '05', };

var orderCodes = reverseSidedDict(orderNames);

var animNames = { meteor: 'cd', breathing: 'ce', stack: 'cf', flow: 'd0',
  wave: 'd1', flash: 'd2', static: 'd3', catchup: 'd4', };

var animCodes = reverseSidedDict(animNames);

class sp108eDevice {
  /**
   *
   * @param {Object} connParams
   *
   * Example connParams:
   *
   *  const connParams = {
   *    host: '192.168.0.1',
   *    port: 8189
   *  };
   */
  constructor(connParams) {
    if (!connParams || !connParams.host || !connParams.port) {
      throw new Error('Params in constructor of sp108eDevice are mandatory');
    }

    this.connParams = connParams;

    this.log = printDebugMsg;

  }

  prettyAnim(hexAnim) {
    let decAnim = parseInt(hexAnim, 16);
    if (hexAnim != 'fa') {
      let result = {};
      if ((decAnim >= 205) && (decAnim <= 212)) {
        result.mono = animCodes[hexAnim];
      }

      if (hexAnim === 'fc') {
        result.mixed = 'auto';
      }

      if ((decAnim >= 0) && (decAnim <= 179)) {
        result.mixed = decAnim + 1;
      }

      if (hexAnim === 'db') {
        result.record = true;
      }

      return result;
    }
  }

  prettyStatus(hexStatus) {
    let status = {
      state: hexStatus.substring(2, 4) === '01' ? 'on' : 'off',
      animation: this.prettyAnim(hexStatus.substring(4, 6)),
      brightness: parseInt(hexStatus.substring(8, 10), 16),
      speed: parseInt(hexStatus.substring(6, 8), 16),
      color: '#' + hexStatus.substring(20, 26),
      white: parseInt(hexStatus.substring(30, 32), 16),
      icType: chipCodes[hexStatus.substring(26, 28)],
      colorOrder: orderCodes[hexStatus.substring(10, 12)],
      ledsPerSegment: parseInt(hexStatus.substring(12, 16), 16),
      numberOfSegments: parseInt(hexStatus.substring(16, 20), 16),
      recordedPatterns: parseInt(hexStatus.substring(28, 30), 16),
    };
    return status;
  }

  /**
   *
   * send command to device
   *
   * @param {string} cmd
   * @param {string} [parameter=NULL_PARAM]
   * @param {number} [responseLength=0]
   */
  async sendHexCmd(cmd, parameter = NULL_PARAM, responseLength = 0) {
    const socket = new net.Socket();
    const client = new PromiseSocket(socket);
    await client.connect(this.connParams.port, this.connParams.host);
    this.log('Connected to device');
    const msg = CMD_PREFIX + parameter.padEnd(6, '0') + cmd + CMD_SUFFIX;
    const raw = Buffer.from(msg, 'hex');
    await client.write(raw);
    this.log('Send: ' + msg);

    let response;
    if (responseLength > 0) {
      response = await client.read(responseLength);
      this.log('Recieve: ' + response.toString('hex'));
    }

    await client.end();

    if (responseLength === 0) {
      this.log('Waiting to protect device cunfuse..');
      await protectWait();
    }

    return response ? response.toString('hex') : '';
  }

  /**
   *
   * send extra data to device
   *
   * @param {string} data
   */
  async sendData(data) {
    const socket = new net.Socket();
    const client = new PromiseSocket(socket);
    await client.connect(this.connParams.port, this.connParams.host);
    this.log('Connected to device');
    const raw = Buffer.from(data, 'utf8');
    await client.write(raw);
    this.log('Send: ' + raw);

    await client.end();

    this.log('Waiting to protect device cunfuse..');
    await protectWait();
  }

  /**
   * Get the device status
   */
  async getStatus() {
    const response = await this.sendHexCmd(CMD_GET_STATUS, NULL_PARAM, 17);
    return this.prettyStatus(response);
  }

  /**
   * Get the device name
   */
  async getDeviceName() {
    const response = await this.sendHexCmd(CMD_GET_NAME, NULL_PARAM, 18);
    return Buffer.from(response, 'hex').toString('utf8');
  }

  /**
   * Toggle leds on/off
   */
  async togglePower() {
    const status = this.prettyStatus(await this.sendHexCmd(CMD_TOGGLE, NULL_PARAM, 17));
    if ((status.state === 'on') && (status.animation.hasOwnProperty('mixed')) &&
      (status.animation.mixed === 'auto')) {
      await this.setMixedColorAnimationAuto();
    }
  }

  /**
   * Turn leds on
   */
  async on() {
    const status = await this.getStatus();
    if (status.state == 'off') {
      return this.togglePower();
    }

  }

  /**
   * Turn leds off
   */
  async off() {
    const status = await this.getStatus();
    if (status.state == 'on') {
      return this.togglePower();
    }

  }

  /**
  * Set the brightness of leds
  * @param {integer} brightness value of integer type 1-255
  */
  async setBrightness(brightness) {
    await this.sendHexCmd(CMD_SET_BRIGHTNESS, intToHex(brightness));
  }

  /**
  * Set the color of leds
  * @param {string} hexColor Color in hex format without hash. for example, 'FFAABB'
  */
  async setColor(hexColor) {
    return await this.sendHexCmd(CMD_SET_COLOR, hexColor);
  }

  /**
  * Set the white value of leds
  * @param {integer} white value of integer type 0-255
  */
  async setWhiteValue (white) {
    return await this.sendHexCmd(CMD_SET_WHITE, intToHex(white));// == 255 ? 0 : white + 1
  }

  /**
  * Set the speed of the animation
  * @param {integer} speed value of integer type 0-255
  */
  async setAnimationSpeed(speed) {
    return await this.sendHexCmd(CMD_SET_SPEED, intToHex(speed));
  }

  /**
  * Set the animation kind for mono color mode
  * @param {string} animMode Animation type for mono color mode
  */
  async setMonoColorAnimation(mode) {
    await this.sendHexCmd(CMD_SET_ANIMATION_MODE, animNames[mode]);
    let status = await this.getStatus();
    if (status.state == 'off') {
      status = await this.sendHexCmd(CMD_TOGGLE, NULL_PARAM, 17);
    }

    return status;
  }

  /**
  * Set mixed color animation mode
  * @param {string} mode value of string type 'auto', '1'..'180'
  */
  async setMixedColorAnimation(mode) {
    let hexMode;
    if (mode === 'auto') {
      await this.sendHexCmd(CMD_SET_MIXED_COLOR_AUTO);
    } else {
      let truncMode = Math.min(mode, 180);
      truncMode = Math.max(truncMode, 1);
      hexMode = intToHex(truncMode - 1);
      await this.sendHexCmd(CMD_SET_ANIMATION_MODE, hexMode);
    }

    let status = await this.getStatus();
    if (status.state === 'off') {
      status = await this.sendHexCmd(CMD_TOGGLE, NULL_PARAM, 17);
    }

    return status;
  }

  /**
  * Set recorded animation mode !not working yet
  */
  async setRecordAnimation() {
    return await this.sendHexCmd(CMD_SET_REC_ANIM_MODE);
  }

  /**
  * Set device name
  * @param {string} name new device name 10 letters max
  */
  async setDeviceName(name) {
    // note you can't send new commands to the box
    // until it completely finish saving the new name
    // so give it sometime until it finish then send any
    // new commands you wish typically 1 to 3 seconds

    let result = await this.sendHexCmd(CMD_SET_DEVICE_NAME, NULL_PARAM, 1);

    if (result == 31) {
      return await this.sendData(name);
    }
  }

  // segNumber * ledNumber <= Maximum 2048 LEDs

  /**
  * Set number of segments on led strip
  * @param {integer} [segNumber=1] value of integer
  */
  async setNumberOfSegments(segNumber = 1) {
    return await this.sendHexCmd(CMD_SET_SEGMENT_NUMBER, intToHex(segNumber));
  }

  /**
  * Set number of led number in one segment of led strip
  * @param {integer} ledNumber value of integer max 300
  */
  async setLedsPerSegments(ledNumber) {
    return await this.sendHexCmd(CMD_SET_LEDS_PER_SEGMENT, intToHex(ledNumber));
  }

  /**
  * Set type of chip on strip
  * @param {string} type value from chipNames array
  */
  async setChipType(type) {
    return await this.sendHexCmd(CMD_SET_CHIP_TYPE, chipNames[type]);
  }

  /**
  * Set red? green and blue color order of led strip
  * @param {string} order value from orderNames array
  */
  async setColorOrder(order) {
    return await this.sendHexCmd(CMD_SET_COLOR_ORDER, orderNames[order]);
  }

}

exports.sp108eDevice = sp108eDevice;
exports.chipNames = chipNames;
exports.chipCodes = chipCodes;
exports.orderNames = orderNames;
exports.orderCodes = orderCodes;
exports.animNames = animNames;
exports.animCodes = animCodes;
