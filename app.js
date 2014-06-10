var express = require('express');
var favicon = require('serve-favicon');
var logger = require('morgan');
var methodOverride = require('method-override');
var cookieParser = require('cookie-parser');
var session = require('express-session');
var errorHandler = require('errorhandler');
var path = require('path');

//Ensures that all messages for a socket will be sent to the process where the socket is hosted
var sticky = require('sticky-session');

//Allows messages to be sent to sockets hosted on other processes
var redis = require('socket.io-redis');

//A new process will be forked for each logical CPU
var cpus = require('os').cpus().length;

//Parse command line parameters
// -s - runs the app in a single thread
var argv = require('minimist')(process.argv.slice(2));

if (argv.s) {
    // Run the application in a single thread
    var server = setupApp();
    server.listen(3000, function () {
        console.log("Server started on a single process with pid " + process.pid +" on 3000 port");
    });
}
else {
    // Sticky-sessions module is balancing requests using their IP address.
    // Thus client will always connect to same worker server, and socket.io will work as expected, but on multiple processes.
    sticky(function (cpus) {
        // A new proccess will be forked for every cpu
        // This code will be executed only in slave workers
        console.log("A process with pid "+ process.pid +" has been forked.");
        return setupApp();
    }).listen(3000, function () {
        console.log('Server started on multiple processes on 3000 port');
    });
}

function setupApp () {
    var app = express();

    // all environments
    app.set('port', process.env.PORT || 3000);
    app.set('views', path.join(__dirname, 'views'));
    //app.use(favicon(__dirname + '/public/favicon.ico'));
    app.use(logger('dev'));
    app.use(methodOverride());
    app.use(cookieParser('your secret here'));
    app.use(session());

    app.use(express.static(path.join(__dirname, 'public')));

    var http = require('http');

    var server = http.createServer(app);
    io = require('socket.io')(server);

    //All sockets will be stored in Redis so they can retrieve information from other workers
    io.adapter(redis({ host: 'localhost', port: 6379 }));

    io.sockets.on("connection", function (socket) {
        console.log('socket connected to worker with pid ' + process.pid);

        io.sockets.emit("New connection");

        socket.on("message", function (data) {
            io.sockets.emit("new message", data);
        });
    });

    return server;
}