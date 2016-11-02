/**
 * Copyright (c) 2016, Foothill-De Anza Community College District
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation and/or
 * other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
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
    // Match event to a college
    let college = getCollegeForTerm(event.term);

    // Identify type of event, and delegate to the appropriate handler
    if(event.type === TYPE_SYNC_PERSON) {
        return SyncPerson(college, event);
    }
    else if(event.type === TYPE_ENROLL_STUDENT) {
        return EnrollStudent(college, event);
    }
    else if(event.type === TYPE_DROP_STUDENT) {
        return DropStudent(college, event);
    }
    else if(event.type === TYPE_CANCEL_SECTION) {
        return CancelCourseSection(college, event);
    }
    else {
        Logger.warn(`Ignoring event due to an unsupported type`, event);
    }
}

// Module exports
module.exports = {
    getPendingEvents: getPendingEvents
};
