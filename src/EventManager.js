/**
 * Handles querying the CANVASLMS_EVENTS custom table in Banner for changes in
 * classes that may need to be processed and sent to Canvas.
 * @license BSD-3-Clause
 * @module
 */

'use strict';
let BannerOperations = require('./BannerOperations.js');
let CollegeManager = require('./CollegeManager.js');
let Config = require('config');
let Logger = require('fhda-logging').getLogger('event-manager');

// Load event handler modules
let SyncPerson = require('./event-handlers/SyncPerson.js');
let EnrollStudent = require('./event-handlers/EnrollStudent.js');
let DropStudent = require('./event-handlers/DropStudent.js');
let CancelCourseSection = require('./event-handlers/CancelCourseSection.js');

// Event type constants
const TYPE_SYNC_PERSON = 0;
const TYPE_ENROLL_STUDENT = 1;
const TYPE_DROP_STUDENT = 2;
const TYPE_CANCEL_SECTION = 3;

/**
 * Lookup a college based on the term code from an event.
 * @param  {String} termCode Banner SIS term code for an event
 * @return {String} A matching college configuration object
 */
function getCollegeForTerm(termCode) {
    if(termCode[5] === '1') {
        return CollegeManager.foothill;
    }
    else if(termCode[5] === '2') {
        return CollegeManager.deanza;
    }
}

// TODO: Rewrite this function to match a college to an entire event object
// rather than a term code

/**
 * Queries the CANVASLMS_EVENTS table to fetch the latest pending events to be processed.
 * @param  {Boolean} [autoReschedule=Config.eventmanager.enabled] Should the event sync auto-reschedule the next iteration?
 */
function getPendingEvents(autoReschedule=Config.eventmanager.enabled) {
    Logger.info(`Checking Banner for new events`);

    // Get latest pending events
    BannerOperations.getPendingEvents()
        .map(handleEvent, {concurrency: 4})
        
        /****
        Deprecated 11/16/2016
        .catch(error => {
            Logger.error(`An error occurred while processing Banner sync events`, error);
        })
        ****/

        .finally(() => {
            Logger.info(`Completed Banner event synchronization`);

            // Is automatic rescheduling enabled?
            if(autoReschedule) {
                setTimeout(getPendingEvents, Config.eventmanager.interval);
                Logger.verbose(`Scheduled next event sync iteration`);
            }
        });
}

/**
 * Evaluate an event to be processed, and execute the appropriate handler to
 * fufill its requirements
 * @param  {Object} event The event to be evaluated
 * @return {Promise} Resolved when the event has been processed
 */
function handleEvent(event) {
    // Match event to a college
    let college = getCollegeForTerm(event.term);

    // Check if the college object appears invalid
    if(!(college)) {
        Logger.verbose(`Ignoring event because the associated college configuration is not enabled or does not exist`, event);
    }
    // Identify type of event, and delegate to the appropriate handler
    else if(event.type === TYPE_SYNC_PERSON) {
        return SyncPerson(college, event)
            .catch(error => {
                Logger.error('Failed to handle person sync event (type 0) due to an error', [error, event]);
            });
    }
    else if(event.type === TYPE_ENROLL_STUDENT) {
        return EnrollStudent(college, event)
            .catch(error => {
                Logger.error('Failed to handle student enrollment event (type 1) due to an error', [error, event]);
            });
    }
    else if(event.type === TYPE_DROP_STUDENT) {
        return DropStudent(college, event)
            .catch(error => {
                Logger.error('Failed to handle student drop event (type 2) due to an error', [error, event]);
            });
    }
    else if(event.type === TYPE_CANCEL_SECTION) {
        return CancelCourseSection(college, event)
            .catch(error => {
                Logger.error('Failed to handle section cancellation event (type 3) due to an error', [error, event]);
            });
    }
    else {
        Logger.warn(`Ignoring event due to an unsupported type`, event);
    }
}

// Module exports
module.exports = {
    getPendingEvents: getPendingEvents
};
