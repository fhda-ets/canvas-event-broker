'use strict';

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load dependencies
let Logger = require('fhda-logging').getLogger('test-suite');
let LoggerWebsocket = require('fhda-logging').getLogger('mock-websocket');

// Load Websocket handler moduler
let WsCreateCourse = require('../../websocket-handlers/canvas/CreateCourse.js');

// Create a mock request
let mockRequest = {
    college: 'deanza',
    parentTerm: '201722',
    parentCrn: '21027',
    sections: [
        {term: '201722', crn: '21027'}
    ]
};

// Create a mock websocket object to bind into event handler
let mockWebsocket = {
    decoded_token: {},
    emit: function(eventType, data={}) {
        LoggerWebsocket.verbose(`Handled mock websocket event`, [{eventType: eventType}, data]);
    }
};

// Execute request
WsCreateCourse.bind(mockWebsocket)(mockRequest/*, result => {
    if(result.status === 'done') {
        Logger.info('Test suite completed');
    }
}*/);
