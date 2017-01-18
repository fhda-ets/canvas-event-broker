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
module.exports = function(college, event) {
    Logger.info('Handling section cancellation event', event);

    // Delete Canvas section
    return college.deleteSection(event.term, event.crn)
        .catch(Errors.UntrackedSection, () => {
            Logger.warn(`Ignoring event because it does not match any known Canvas sections`, event);
            
        })
        .catch(error => {
            Logger.error(`Failed to handle section cancellation event due to an error`, [error, event]);
        })
        .finally(() => {
            return BannerOperations.deleteEvent(event);
        });
};
