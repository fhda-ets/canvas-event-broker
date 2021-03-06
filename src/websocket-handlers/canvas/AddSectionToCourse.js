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
let Logger = require('fhda-pubsub-logging')('ws-action-delete-sections');
let ProgressMonitor = require('../../ProgressMonitor.js');
let WebsocketUtils = require('../../WebsocketUtils.js');

/**
 * Handle a websocket request to delete a Canvas course site/classroom.
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function (data, respond) {
    // Create an alternate reference to the web socket
    let socket = this;

    // Capture audit record
    await BannerOperations.recordWebAudit(
        socket.decoded_token.aud,
        'canvas:addSectionToCourse',
        data,
        socket.conn.remoteAddress);

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Create a new progress monitir
    let progress = new ProgressMonitor();

    // Attach an event handler to reporting progress changed back to the UI
    progress.on('progressUpdated', function(data) {
        socket.emit('ui:progress:setPercent', data);
    });

    // Tell the client to display a progress bar
    socket.emit('ui:progress:show', {text: `Adding new section to course (CRN ${data.crn})`});

    await college.createSection(data.term, data.crn, data.canvasCourseId, progress)
        .then(() => {
            socket.emit('ui:progress:hide');
            respond({status: 'done'});
        })
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to add a section to an existing Canvas course',
            Logger,
            respond
        ));
};
