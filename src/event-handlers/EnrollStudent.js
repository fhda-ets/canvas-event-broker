'use strict';
let BannerOperations = require('../BannerOperations.js');
let Errors = require('../Errors.js');
let Logger = require('fhda-logging').getLogger('event-handler-enroll-student');

module.exports = function(college, event) {
    Logger.info('Handling student enrollment event', event);

    // Get Banner person profile
    return BannerOperations.getPerson(event.pidm)
        .then(person => {
            // Enroll the student in the requested Canvas section
            return college.enrollStudent(event.term, event.crn, person);
        })
        .then(() => {
            // Delete the completed event
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(Errors.UntrackedSection, () => {
            Logger.warn(`Ignoring event because it does not match any known Canvas sections`, event);
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(error => {
            Logger.error(`Failed to handle student enrollment event due to an error`, [error, event]);
        });
};
