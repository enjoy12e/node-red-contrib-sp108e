module.exports = function(RED) {
    function Sp108eDeviceNode(config) {
        RED.nodes.createNode(this,config);
        this.host = config.host;
        this.port = config.port;
        this.name = config.name;
    }
    RED.nodes.registerType("sp108eDevice",Sp108eDeviceNode);
}