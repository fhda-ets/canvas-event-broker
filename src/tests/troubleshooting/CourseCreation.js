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

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load dependencies
let Logger = require('fhda-pubsub-logging')('test-suite');
let LoggerWebsocket = require('fhda-pubsub-logging')('mock-websocket');

// Load Websocket handler moduler
let WsCreateCourse = require('../../websocket-handlers/canvas/CreateCourse.js');

// Create a mock request
let mockRequest = {
    college: 'deanza',
    parentTerm: '201722',
    parentCrn: '21027',
    sections: [
        {term: '201722', crn: '21027'}
    ]
};

// Create a mock websocket object to bind into event handler
let mockWebsocket = {
    decoded_token: {},
    emit: function(eventType, data={}) {
        LoggerWebsocket.verbose(`Handled mock websocket event`, [{eventType: eventType}, data]);
    }
};

// Execute request
WsCreateCourse.bind(mockWebsocket)(mockRequest/*, result => {
    if(result.status === 'done') {
        Logger.info('Test suite completed');
    }
}*/);
