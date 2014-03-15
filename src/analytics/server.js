// Set up logging
var logger = require('caterpillar').createLogger( { level: 7 });
var filter = require('caterpillar-filter').createFilter();
var human = require('caterpillar-human').createHuman();
logger.pipe(filter).pipe(human).pipe(process.stdout);

// Import utilities
var util = require('util');

// Load data logic module
var logic = require('./lib/logic');

// Set up websocket server using socket.io
var pushServerApp = require('express')()
var pushServer = require('http').createServer(pushServerApp)
var io = require('socket.io').listen(pushServer);
io.set('log level', 1);
var express = require('express');

pushServer.listen(8000, function() {
  logger.log('info', 'Analytics server listening at http://0.0.0.0:8000');
});

// Allow clients to subscribe to paths
io.sockets.on('connection', function(socket) {
    socket.on('subscribe', function(room) {
    socket.join(room);
  });
});

// Serve static HTML page for websocket server
pushServerApp.configure(function () {
  pushServerApp.use( express.cookieParser() );
  pushServerApp.use( express.session({secret: 'secret', key: 'express.sid'}) );
  pushServerApp.use( pushServerApp.router )
});

// Redirect the root to the dashboard
pushServerApp.get('/', function (request, response) {
  response.redirect('/dashboard');
});

// Set up REST API server
pushServerApp.get('*', function(request, response, next) {
    // Hand over to next route in case request is for the dashboard
    if ( request.url.indexOf('dashboard') != -1 ) {
      next();
    }
    var path = request.url.substring(1);
    path = path.replace(/\//g, '.').toLowerCase();
    data = logic.retrieve(path, false, function(data) {
      response.writeHead(200, {"Content-Type": "application/json"});
      response.end(data);
    });
});

// Serve static assets as well
pushServerApp.use( express.static(__dirname+'/html') );

// Main event loop
setInterval( 
  function(){
    for ( path in io.sockets.manager.rooms ) {
      if ( path ) {
       path = path.substring(1);
       logic.retrieve(path, true, function(data) {
        io.sockets.in(path).emit(path, data);
       });
      }
    } 
  }
  , 10000
);
