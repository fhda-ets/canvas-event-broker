'use strict';
let BannerOperations = require('../BannerOperations.js');
let Logger = require('fhda-logging').getLogger('event-handler-sync-person');

module.exports = function(college, event) {
    Logger.info('Handling person sync event', event);

    // Lookup the person in Banner
    return BannerOperations.getPerson(event.pidm)
        .then(person => {
            // Sync Canvas user profile with latest data from Banner
            return college.canvasApi.syncUser(
                person.campusId,
                person.firstName,
                person.lastName,
                person.email);
        })
        .then(() => {
            // Delete the completed event
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(error => {
            Logger.error(`Failed to handle person sync request due to an error`, [error, event]);
        });
};
