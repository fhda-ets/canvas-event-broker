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
let Flow = require('lodash/flow');
let Levels = require('./Levels');
let TransformObject = require('lodash/transform');
let EventEmitter = require('eventemitter3');
let PackageDebug = require('./PackageDebug');

// Create central event emitter
let emitter = new EventEmitter();

// Get the root logger level
let rootLevel = Levels[Config.logging.level].value;

// Load transport modules
let transports = loadTransports();

// Create chained transport for dispatching events to transports
let transportsFn = Flow(...transports);

// Attach global event handler
emitter.on('event', function(data) {
    if(Levels[data.level].value >= rootLevel) {
        // Generate a timestamp to share across transports
        data.timestamp = new Date();

        // Dispatch event to transports
        transportsFn(data);
    }
});

function loadTransports() {
    PackageDebug.log('Loading logging transports');

    // Iterate each configured transport and load its related module
    // (modules that cannot be found are reported and skipped)
    return TransformObject(Config.logging.transports, (result, configuration, transportType) => {
        PackageDebug.log(`Attempting to load transport '${transportType}'`);

        // Skip transports with a non-truthy configuration
        if(!(configuration)) {
            return result;
        }

        if(transportType === 'console') {
            result.push(require('./transports/Console')(configuration));
            PackageDebug.log(`Loaded transport 'console'`);
        }
        else if(transportType === 'rawConsole') {
            result.push(require('./transports/RawConsole')(configuration));
            PackageDebug.log(`Loaded transport 'rawConsole'`);
        }
        else if(transportType === 'rotatingFile') {
            result.push(require('./transports/RotatingFile')(configuration));
            PackageDebug.log(`Loaded transport 'rotatingFile'`);
        }
        else if(transportType === 'splunk') {
            result.push(require('./transports/Splunk')(configuration));
            PackageDebug.log(`Loaded transport 'splunk'`);
        }
        else if(configuration.module) {
            result.push(require(configuration)(configuration));
            PackageDebug.log(`Loaded transport '${transportType}'`);
        }
        else {
            PackageDebug.error(`Transport type ${transportType} will not be loaded because it is unsupported`);
        }

        return result;
    }, []);
}

module.exports = emitter;