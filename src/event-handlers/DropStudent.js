'use strict';
let BannerOperations = require('../BannerOperations.js');
let Errors = require('../Errors.js');
let Logger = require('fhda-logging').getLogger('event-handler-drop-student');

module.exports = function(college, event) {
    Logger.info('Handling student drop event', event);

    // Drop student from the requested Canvas section
    return college.dropStudent(event.term, event.crn, event.pidm)
        .then(() => {
            // Delete the completed event
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(Errors.UntrackedEnrollment, () => {
            Logger.warn(`Ignoring event because it does not match any known Canvas enrollments`, event);
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(error => {
            Logger.error(`Failed to handle student drop event due to an error`, [error, event]);
        });
};
