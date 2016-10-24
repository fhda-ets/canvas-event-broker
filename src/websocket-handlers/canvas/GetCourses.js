'use strict';
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-get-canv-courses');
let WebsocketUtils = require('../../WebsocketUtils.js');

module.exports = function (data, respond) {
    return CollegeManager[data.college]
        .canvasApi
        .getCoursesForUser(data.term, this.decoded_token.aud, data.withSections)
        .tap(respond)
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to lookup course memberships in Canvas',
            Logger,
            respond
        ));
};
