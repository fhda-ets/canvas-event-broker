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
let MetadataUtilities = require('../MetadataUtilities');
let Purdy = require('purdy');
let SpeedDate = require('speed-date');

/**
 * Default timestamp format for Speed Date if an alternative is provided
 * by the developer
 */
const defaultTimeFormat = 'MM-DD-YYYY hh:mm:ss A';

/**
 * Defaults for using Purdy to format objects
 */
const purdyDefaults = { plain: true, depth: 4 };

/**
 * Format an event, typically into a final string, suitable to be rendered
 * by a logging transport
 * @param {Object} transportConfig Config object for the transport
 * @param {Object} data Event data payload
 * @returns {any} A formatted event
 */
function format(transportConfig, data) {
    // Format the event timestamp
    let event = SpeedDate.cached(
        transportConfig.timestampFormat || defaultTimeFormat,
        data.timestamp);

    // Append logger level
    if(data.level) {
        event += ` (${data.level})`;
    }

    // Append logger label if it is not the root
    if(data.label && data.label !== '*') {
        event += ` (${data.label})`;
    }

    // Append the event message
    event += ` ${data.message} `;

    // If metadata is provided, perform post-processing without coloring\
    // to format specific property types such as errors
    if(data.metadata) {
        let processedMetadata = MetadataUtilities.process(data.metadata, false);
        event += Purdy.stringify(processedMetadata, purdyDefaults);
    }

    // Return formatted message
    return event;
}

module.exports = {
    format: format
};