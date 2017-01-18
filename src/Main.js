/**
 * Application entry point. Bootstraps other modules like the API server
 * and event manager.
 * @license BSD-3-Clause
 * @module
 * @see {@link module:ApiServer}
 * @see {@link module:EventManager}
 */

'use strict';

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load application modules
let Config = require('config');
let Logger = require('fhda-pubsub-logging')('main');

// Check and start the event manager if enabled
if(Config.eventmanager.enabled) {
    require('./EventManager.js').getPendingEvents();
}

// Check and start the Socket.IO API server if enabled
if(Config.apiserver.enabled) {
    require('./ApiServer.js');
}

// Check and start the Slackbot integration if enabled
if(Config.slackbot) {
    if(Config.slackbot.enabled) {
        require('./Slackbot.js');
    }
}

// Attach a listener to identify SIGINT events and exit gracefully
process.on('SIGINT', () => {
    Logger.info('Received SIGTERM; exiting');
    process.exit(0);
});
