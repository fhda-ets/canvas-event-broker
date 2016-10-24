'use strict';
let BannerOperations = require('../../BannerOperations.js');
let Logger = require('fhda-logging').getLogger('ws-action-get-ins-sched');
let WebsocketUtils = require('../../WebsocketUtils.js');

module.exports = function (data, respond) {
    BannerOperations
        .getInstructorSchedule(data.termCode, this.decoded_token.aud)
        .then(respond)
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to lookup an instructor schedule',
            Logger,
            respond
        ));
};
