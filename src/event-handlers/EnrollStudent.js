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
let BannerOperations = require('../BannerOperations.js');
let Errors = require('../Errors.js');
let Logger = require('fhda-pubsub-logging')('event-handler-enroll-student');

/**
 * Handle a student enrollment event from Banner.
 * @license BSD-3-Clause
 * @module
 * @param  {String} college College identifier ('deanza' or 'foothill')
 * @param  {Object} event An event object
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function(college, event) {
    Logger.info('Handling student enrollment event', event);

    try {
        // Get Banner person profile
        let person = await BannerOperations.getPerson(event.pidm);

        // Enroll the student in the requested Canvas section
        await college.enrollStudent(event.term, event.crn, person);
    }
    catch(error) {
        if(error instanceof Errors.UntrackedSection) {
            Logger.warn(`Ignoring event because it does not match any known Canvas sections`, event);
        }   
        else {
            Logger.error(`Failed to handle student enrollment event due to an error`, {
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
