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
        .catch(error => {
            Logger.error(`An error occurred while processing Banner sync events`, error);
        })
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
    // Identify type of event, and delegate to the appropriate handler
    if(event.type === TYPE_SYNC_PERSON) {
        return handleIfCollegeValid(
            getCollegeForTerm(event.term),
            event,
            SyncPerson);
    }
    else if(event.type === TYPE_ENROLL_STUDENT) {
        return handleIfCollegeValid(
            getCollegeForTerm(event.term),
            event,
            EnrollStudent);
    }
    else if(event.type === TYPE_DROP_STUDENT) {
        return handleIfCollegeValid(
            getCollegeForTerm(event.term),
            event,
            DropStudent);
    }
    else if(event.type === TYPE_CANCEL_SECTION) {
        return handleIfCollegeValid(
            getCollegeForTerm(event.term),
            event,
            CancelCourseSection);
    }
    else {
        Logger.warn(`Ignoring event due to an unsupported type`, event);
        return BannerOperations.deleteEvent(event);
    }
}

/**
 * Helper function to expedite the validation of a college object, and if
 * that is valid, then execute and return a Promise for the provided
 * async handler used to process the event.
 * @param {Object} college College configuration for the event (if matched)
 * @param {Object} event The event itself
 * @param {Function} handlerFunction Function to process the event
 * @returns {Promise} Resolved when handler is complete, or the event is deleted if the college is unknown
 */
function handleIfCollegeValid(college, event, handlerFunction) {
    // Validate college object
    if(!(college)) {
        // Ignore event and delete it from the queue
        Logger.verbose(`Ignoring event because the associated college configuration is not enabled or does not exist`, event);
        return BannerOperations.deleteEvent(event);
    }
    
    // Dispatch event to provided handler function
    return handlerFunction(college, event);
}

// Module exports
module.exports = {
    getPendingEvents: getPendingEvents
};
