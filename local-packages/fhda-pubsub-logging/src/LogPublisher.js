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
let EventRouter = require('./EventRouter');
let Levels = require('./Levels');
let PackageDebug = require('./PackageDebug');

/**
 * Create a Map for caching log publishing objects by name
 */
let loggerCache = new Map();

/**
 * Create a new log publisher with named functions for each log level.
 * Events published through this function will be dispatched to the 
 * typical transports, plus additional publishing if an additional 
 * event name is specified with each logged event.
 * @param {String} [loggerName='*']
 * @returns {Object} Log publisher object with level functions
 */
function create(loggerName='*') {
    // Check the cache for an existing named logger
    if(loggerCache.has(loggerName)) {
        PackageDebug.log(`Using existing logger ${loggerName} from cache`);
        return loggerCache.get(loggerName);
    }

    // Create new object that will be expored for the log publisher
    let exportedObject = {
        router: EventRouter
    };

    PackageDebug.log('Checking configured log levels');

    // Iterate configured log levels
    Object.keys(Levels).forEach(levelKey => {
        // Get log level specification
        let levelSpec = Levels[levelKey];

        PackageDebug.log(`Creating ${levelKey}(...) (value = ${levelSpec.value}) for named logger '${loggerName}'`);

        // Create a function matching for reporting events at this logging level
        exportedObject[levelKey] = (message, metadata, additionalDispatch) => {
            // Generate an event object
            let event = {
                label: loggerName,
                level: levelSpec.label,
                message: message,
                metadata: metadata
            };

            // Send event to logging transports
            EventRouter.emit('event', event);

            // Is an additional dispatch requested?
            if(additionalDispatch) {
                // Emit again on additional event name
                EventRouter.emit(additionalDispatch, event);
            }
        };
    });

    // Save to cache
    loggerCache.set(loggerName, exportedObject);

    // Return the new log publisher object
    return exportedObject;
}

module.exports = {
    create: create
};