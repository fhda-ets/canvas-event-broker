'use strict';
let BannerOperations = require('../../BannerOperations.js');
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-sync-student');

module.exports = function (data, respond) {
    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Get Banner person profile
    return BannerOperations.getPerson(data.identity)
        .then(person => {
            // Run student enrollment sync checks
            return college.syncStudent(data.term, person);
        })
        .then(() => {
            respond({status: 'done'});
        });
};
