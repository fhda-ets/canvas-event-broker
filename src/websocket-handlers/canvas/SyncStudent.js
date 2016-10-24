'use strict';
let BannerOperations = require('../../BannerOperations.js');
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-sync-student');
let WebsocketUtils = require('../../WebsocketUtils.js');

module.exports = function (data, respond) {
    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Get Banner person profile
    return BannerOperations.getPerson(data.identity)
        .then(person => {
            // Run student enrollment sync checks
            return college.syncStudent(data.term, person);
        })
        .then(syncOps => {
            respond({status: 'done', ops: syncOps});
        })
        .catch(WebsocketUtils.handleError.bind(
            null,
            'A serious error occurred while attempting to sync enrollment for a student between Banner and Canvas',
            Logger,
            respond
        ));
};
