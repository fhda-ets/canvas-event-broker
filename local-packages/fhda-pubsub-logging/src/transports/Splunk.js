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
let Config = require('config');
let Hyperquest = require('hyperquest');
let MetadataUtilities = require('../MetadataUtilities');
let PackageDebug = require('../PackageDebug');

module.exports = function(transportConfig) {

    PackageDebug.log('Completed configuration of splunk transport');

    // Create config object for HTTP requests
    let httpRequestConfig = {
        headers: {
            'Authorization': `Splunk ${transportConfig.collectorAuthKey}`
        }
    };

    return function(data) {
        // If metadata is provided, perform processing to extract readable properties,
        // and seperate properties from a runtime error if discovered
        if(data.metadata) {
            var meta = MetadataUtilities.process(data.metadata, false);
        }

        // Convert the event to JSON
        let jsonPayload = JSON.stringify({
            time: data.timestamp / 1000,
            source: Config.logging.source,
            event: Object.assign({
                environment: Config.logging.environment,
                label: data.label,
                level: data.level,
                message: data.message   
            }, meta)
        });

        // Create a request to Splunk
        let request = Hyperquest.post(transportConfig.uri, httpRequestConfig, handleHttpResponse);

        // Write the JSON graph, and close the stream
        request.end(jsonPayload, 'utf8');

        // Return payload for transport chaining
        return data;
    };

};

function handleHttpResponse(error, response) {
    if(error) {
        PackageDebug.error(`Splunk transport encountered an error\n${error}`);    
    }
    else {
        if(response.statusCode !== 200) {
            PackageDebug.error(`Splunk responded error ${response.statusCode} to last event delivery`);
        }
    }
}