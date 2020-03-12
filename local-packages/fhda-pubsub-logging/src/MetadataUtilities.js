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
let MapValues = require('lodash/mapValues');
let Stacky = require('stacky');

/**
 * Defaults for using Stacky to format error stack traces
 */
const stackyDefault = {
    maxMethodPadding: 15
};

/**
 * Defaults for using Stacky to format error stack traces
 */
const stackyNoColoring = {
    maxMethodPadding: 15,
    styles: {
        method: (string) => string,
        location: (string) => string,
        line: (string) => string,
        column: (string) => string,
        unimportant: (string) => string
    }    
};

/**
 * Mapping function for Lodash.mapValues(...) that applies value transformations
 * with coloring
 */
const defaultMapperColoring = defaultMapper();

/**
 * Mapping function for Lodash.mapValues(...) that applies value transformations
 * without coloring
 */
const defaultMapperNoColoring = defaultMapper(false);

/**
 * Generate a helper function to use with Lodash.mapValues(...) to perform additional
 * transformations on certain types of values found at the first level in
 * event metdata
 * @param {Boolean} coloring True if coloring should be applied, false if not
 * @returns {any} Either a transformed value, or the original if nothing was done
 */
function defaultMapper(coloring=true) {
    return function(value) {
        // Validate the value
        if(!(value)) return value;

        // Does the object appear to be an error with a stack trace?
        if(value.stack) {
            return {
                message: value.message || undefined,
                stack: '\n' + Stacky.pretty(value.stack, (coloring) ? stackyDefault : stackyNoColoring)
            };
        }

        // Else, return the value
        return value;   
    }; 
}


/**
 * Take the provided metadata object, and process it with additional value
 * transformation that can help make the data more readable when rendered
 * out through various kinds of log transports
 * @param {Object} metadata The event metadata object
 * @param {Boolean} [coloring=true] True if coloring should be applied, false if not
 * @returns {Object} Metadata with changes applied
 */
function process(metadata, coloring=true) {
    return MapValues(metadata, (coloring) ? defaultMapperColoring : defaultMapperNoColoring);
}

module.exports = {
    defaultMapper: defaultMapper,
    process: process
};