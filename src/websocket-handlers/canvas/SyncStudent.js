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
let Logger = require('fhda-pubsub-logging')('ws-action-sync-student');
let WebsocketUtils = require('../../WebsocketUtils.js');

/**
 * Handle a websocket request to synchronize student enrollment between Banner
 * and Canvas (intended as a tool to help admins quickly resolve discrepancies).
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function (data, respond) {
    // Capture audit record
    await BannerOperations.recordWebAudit(
        this.decoded_token.aud,
        'canvas:syncStudent',
        data,
        this.conn.remoteAddress);

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Get Banner person profile
    let person = await BannerOperations.getPerson(data.identity);

    try {
        // Verify person object
        if(!(person)) {
            throw new Error(`Could not find ${data.identity.campusId} in Banner. Check to make sure that you used the correct campus ID, and that the intended person is set up correctly in Banner`);
        }

        Logger.info(`Fetched Banner person object for ${data.identity.campusId}`, person);

        // Run student enrollment sync checks
        let syncOps = await college.syncStudent(data.term, person);
        respond({status: 'done', ops: syncOps});
    }
    catch(error) {
        WebsocketUtils.handleAsyncError(
            `A serious error occurred while attempting to sync enrollment for a student between Banner and Canvas' for ${data.identity.campusId} at '${data.college}'`,
            Logger,
            respond,
            error);
    }
};
