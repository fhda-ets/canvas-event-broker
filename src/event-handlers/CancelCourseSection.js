'use strict';
let BannerOperations = require('../BannerOperations.js');
let Errors = require('../Errors.js');
let Logger = require('fhda-logging').getLogger('event-handler-cancel-section');

module.exports = function(college, event) {
    Logger.info('Handling section cancellation event', event);

    // Delete Canvas section
    return college.deleteSection(event.term, event.crn)
        .then(() => {
            // Delete the completed event
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(Errors.UntrackedSection, () => {
            Logger.warn(`Ignoring event because it does not match any known Canvas sections`, event);
            return BannerOperations.deleteEvent(event.id);
        })
        .catch(error => {
            Logger.error(`Failed to handle section cancellation event due to an error`, [error, event]);
        });
};
