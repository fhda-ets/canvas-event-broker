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
let BannerOperations = require('../../BannerOperations.js');
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-pubsub-logging')('ws-action-get-canv-courses');
let WebsocketUtils = require('../../WebsocketUtils.js');

/**
 * Handle a websocket request to get a list of Canvas courses currently
 * associated with the identified user.
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function (data, respond) {
    // Capture audit record
    await BannerOperations.recordWebAudit(
        this.decoded_token.aud,
        'canvas:getCourses',
        data,
        this.conn.remoteAddress);

    // Lookup college configuration
    let college = CollegeManager[data.college];

    await college
        .canvasApi.getCoursesForUser(
            data.term,
            this.decoded_token.aud,
            data.withSections,
            ['teacher'])
        .map(course => {
            // Decorate course with promise to check on content migrations
            course.migrations = college.canvasApi.listActiveMigrations(course.id);

            // Resolve
            return Promise.props(course);
        })
        .tap(result => {
            Logger.info('Result of getting courses from Canvas', result);
            respond(result);
        })
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to lookup course memberships in Canvas',
            Logger,
            respond
        ));
};
