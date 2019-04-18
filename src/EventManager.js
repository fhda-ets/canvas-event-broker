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
let Logger = require('fhda-pubsub-logging')('event-manager');

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

/**
 * Queries the CANVASLMS_EVENTS table to fetch the latest pending events to be processed.
 * @param  {Boolean} [autoReschedule=Config.eventmanager.enabled] Should the event sync auto-reschedule the next iteration?
 */
async function getPendingEvents(autoReschedule=Config.eventmanager.enabled) {
    Logger.info(`Checking Banner for new events`);

    try {
        // Get latest pending events
        let result = await BannerOperations.getPendingEvents()
            // Evaluate and process events in parallel
            .map(handleEvent, {concurrency: 4});

        Logger.info(`Completed Banner event synchronization (${result.length} events)`);
    }
    catch(error) {
        Logger.error(`An error occurred while processing Banner sync events`, { error: error });
    }
    finally {
        // Is automatic rescheduling enabled?
        if(autoReschedule) {
            setTimeout(getPendingEvents, Config.eventmanager.interval);
            Logger.verbose(`Scheduled next event sync iteration`);
        }
    }
}

/**
 * Evaluate an event to be processed, and execute the appropriate handler to
 * fufill its requirements
 * @param  {Object} event The event to be evaluated
 * @return {Promise} Resolved when the event has been processed
 */
async function handleEvent(event) {
    switch(event.type) {
        case TYPE_SYNC_PERSON:
            await handleIfCollegeValid(getCollegeForTerm(event.term), event, SyncPerson);
            break;
        // case TYPE_ENROLL_STUDENT:
        //     await handleIfCollegeValid(getCollegeForTerm(event.term), event, EnrollStudent);
        //     break;
        // case TYPE_DROP_STUDENT:
        //     await handleIfCollegeValid(getCollegeForTerm(event.term), event, DropStudent);
        //     break;
        // case TYPE_CANCEL_SECTION:
        //     await handleIfCollegeValid(getCollegeForTerm(event.term), event, CancelCourseSection);
        //     break;
        default:
            Logger.warn(`Ignoring event due to an unsupported type`, event);
            await BannerOperations.deleteEvent(event);
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
