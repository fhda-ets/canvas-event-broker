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
let Common = require('../../Common.js');
let Logger = require('fhda-pubsub-logging')('ws-action-create-canv-attr');
let WebsocketUtils = require('../../WebsocketUtils.js');

/**
 * Handle a websocket request to create CANV attributes for one or more faculty
 * in Banner.
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function (data, respond) {
    // Validate the calling user is an admin
    if(!(this.decoded_token.canvasAdmin)) {
        respond({status: 'error', message: 'You are not an authorized site manager administrator'});
        return;
    }

    // Capture audit record
    await BannerOperations.recordWebAudit(
        this.decoded_token.aud,
        'banner:createCanvasAttribute',
        data,
        this.conn.remoteAddress);

    // Iterate faculty identities
    await Promise.map(data.campusIds, campusId => {
        // Transform faculty identities into Banner persons
        return BannerOperations.getPerson({campusId: campusId})
            .tap(person => {
                // Create CANV faculty attribute for person
                return BannerOperations.createCanvasFacultyAttribute(person.pidm);
            })
            .then(person => {
                return person.campusId;
            });
    }, Common.concurrency.SINGLE)
    .then(persons => {
        Logger.verbose(`Responding to WS create Canvas attribute action`);
        console.log(persons);

        // Send final response with list of CWIDs that were processed
        respond(persons);
    })
    .catch(WebsocketUtils.handleError.bind(
        this,
        'A serious error occurred while attempting update the CANV attribute for the requested instructors',
        Logger,
        respond
    ));
};
