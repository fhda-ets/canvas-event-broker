'use strict';
let Chalk = require('chalk');
let MetadataUtilities = require('../MetadataUtilities');
let Purdy = require('purdy');
let SpeedDate = require('speed-date');

/**
 * Default timestamp format for Speed Date if an alternative is provided
 * by the developer
 */
const defaultTimeFormat = 'MM-DD-YYYY hh:mm:ss A';

/**
 * Utility function to apply Chalk formatting to the logger label
 * @param {String} label Name of the logger
 * @returns Label with bold, white, underline formatting applied
 */
function colorizeLabel(label) {
    return Chalk.underline.bold.white(label);
}


/**
 * Utility function to apply Chalk formatting to the loggel level
 * @param {String} level Level of the logger handling the event
 * @returns Level with a color indicating severity, and underlining
 */
function colorizeLevel(level) {
    switch(level) {
        case 'error': return Chalk.underline.red(level); 
        case 'warn': return Chalk.underline.yellow(level);
        case 'info': return Chalk.underline.cyan(level);
        case 'verbose': return Chalk.underline.green(level);
        case 'debug': return Chalk.underline.blue(level);
    }
}

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

/**
 * Format an event into a string suitable for rendering by a logging transport
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
        event += ` (${colorizeLevel(data.level)})`;
    }

    // Append logger label if it is not the root
    if(data.label && data.label !== '*') {
        event += ` (${colorizeLabel(data.label)})`;
    }

    // Append the event message
    event += ` ${data.message} `;

    // If metadata is provided, perform post-processing with coloring to
    // format specific property types such as errors
    if(data.metadata) {
        let processedMetadata = MetadataUtilities.process(data.metadata);
        event += Purdy.stringify(processedMetadata, { depth: 4 });
    }

    // Return formatted message
    return event;
}

module.exports = {
    format: format
};