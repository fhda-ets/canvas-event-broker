'use strict';
let BannerOperations = require('../BannerOperations.js');
let Errors = require('../Errors.js');
let Logger = require('fhda-pubsub-logging')('event-handler-cancel-section');

/**
 * Handle a section cancellation event from Banner.
 * @license BSD-3-Clause
 * @module
 * @param  {String} college College identifier ('deanza' or 'foothill')
 * @param  {Object} event An event object
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function(college, event) {
    Logger.info('Handling section cancellation event', event);

    try {
        // Delete Canvas section
        await college.deleteSection(event.term, event.crn)
    }
    catch(error) {
        if(error instanceof Errors.UntrackedEnrollment) {
            Logger.warn(`Ignoring event because it does not match any known Canvas sections`, event);
        }
        else {
            Logger.error(`Failed to handle section cancellation event due to an error`, {
                error: error,
                event: event
            });
        }
    }
    finally {
        // Delete event from queue
        await BannerOperations.deleteEvent(event);
    }
};
