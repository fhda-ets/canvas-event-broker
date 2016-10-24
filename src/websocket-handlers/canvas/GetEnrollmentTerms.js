'use strict';
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-get-enrollment-terms');
let WebsocketUtils = require('../../WebsocketUtils.js');

module.exports = function (data, respond) {
    return CollegeManager[data.college]
        .canvasApi
        .getEnrollmentTerms()
        .tap(respond)
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to lookup enrollment terms in Canvas',
            Logger,
            respond
        ));
};
