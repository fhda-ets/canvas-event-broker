/**
 * Starts an Express web server, and sets up Socket.io to serve web socket
 * requests to Site Manager clients.
 * @license BSD-3-Clause
 * @module
 */

'use strict';
let Config = require('config').get('apiserver');
let Logger = require('fhda-pubsub-logging')('api-server');

// Create Express web application
let Express = require('express')();
let HttpServer = require('http').Server(Express);

// Load middlewares
let BodyParser = require('body-parser');

// Create Socket.IO server
let SocketIo = require('socket.io')(HttpServer);
let SocketIoJwt = require('socketio-jwt');

// Configure routes for traditional HTTP actions
Express.post('/external/sis/grades', BodyParser.text({limit: '1mb', type: 'text/*'}), require('./route-handlers/SisGradeSubmission.js'));

// Start listening
HttpServer.listen(Config.listenPort);
Logger.info(`Created API server on port ${Config.listenPort}`);

// Configure Socket.io JWT authentication
SocketIo.use(SocketIoJwt.authorize({
  secret: Config.jwtSecret,
  handshake: true
}));

// Create event handler for new web socket connections
SocketIo.on('connection', function (socket) {
    Logger.info(`New authenticated websocket client connected`, socket.decoded_token);

    // Register handlers for web socket events
    socket.on('banner:createCanvasAttributes', require('./websocket-handlers/banner/CreateCanvAttribute.js').bind(socket));
    socket.on('banner:getInstructorSchedule', require('./websocket-handlers/banner/GetInstructorSchedule.js').bind(socket));
    socket.on('canvas:addSectionToCourse', require('./websocket-handlers/canvas/AddSectionToCourse.js').bind(socket));
    socket.on('canvas:getCourses', require('./websocket-handlers/canvas/GetCourses.js').bind(socket));
    socket.on('canvas:createCourse', require('./websocket-handlers/canvas/CreateCourse.js').bind(socket));
    socket.on('canvas:deleteCourse', require('./websocket-handlers/canvas/DeleteCourse.js').bind(socket));
    socket.on('canvas:deleteSections', require('./websocket-handlers/canvas/DeleteSections.js').bind(socket));
    socket.on('canvas:getEnrollmentTerms', require('./websocket-handlers/canvas/GetEnrollmentTerms.js').bind(socket));
    socket.on('canvas:migration:getSources', require('./websocket-handlers/canvas/MigrationGetSources.js').bind(socket));
    socket.on('canvas:reconcileEnrollment', require('./websocket-handlers/canvas/ReconcileEnrollment.js').bind(socket));
    socket.on('canvas:syncStudent', require('./websocket-handlers/canvas/SyncStudent.js').bind(socket));
});
