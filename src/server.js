'use strict';

var http = require('http');
var app = require('./bot/app');

const node_env = process.env.NODE_ENV,
    server_port = Number(process.env.SERVER_PORT),
    port =
        node_env == 'production' || node_env == 'staging'
            ? server_port + 8001
            : server_port;

//create a server object:
http.createServer(function(req, res) {
    //console.log('Visited at: ' + : new Date() + ' by: ' + req);
    res.write('server: ' + process.uptime() + ' os: ' + require('os').uptime());
    res.end();
}).listen(server_port);

try {
    //run bot on start
    app();

    //now schedule to run every 24 hours
    setInterval(app, 24 * 60 * 60 * 1000); //24 hours
} catch (err) {
    console.log(err);
}
