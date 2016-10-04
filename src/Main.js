'use strict';

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load application modules
let Config = require('config');
let Logger = require('fhda-logging').getLogger('main');

// Check and start the event manager if enabled
if(Config.eventmanager.enabled) {
    require('./EventManager.js').getPendingEvents();
}

// Check and start the Socket.IO API server if enabled
if(Config.apiserver.enabled) {
    require('./ApiServer.js');
}

// Attach a listener to identify SIGINT events and exit gracefully
process.on('SIGINT', () => {
    Logger.info('Received SIGTERM; exiting');
    process.exit(0);
});
