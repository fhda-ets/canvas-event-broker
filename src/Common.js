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

/**
 * Convert a 6-character Banner term code into a shortened version with just one
 * letter for the quarter, and a two-digit year. As needed, if the term refers
 * the first half of an academic year, then the extracted year is decremented by one.
 * @param  {String} termCode Banner term code
 * @return {String} Shortened academic term suitable for Canvas course names
 */
function abbreviateTermCode(termCode) {
    // Get two-digit year
    let year = parseInt(termCode.substr(0, 4)) - 2000;

    // Convert numeric quarter into letter
    // (also decrements year from academic to the actual calendar year for clarity to end-users)
    if(termCode[4] === '1') {
        return `M${year - 1}`;
    }
    else if(termCode[4] === '2') {
        return `F${year - 1}`;
    }
    else if(termCode[4] === '3') {
        return `W${year}`;
    }
    else if(termCode[4] === '4') {
        return `S${year}`;
    }
}

/**
 * Use regular expressions to remove extra characters from a Banner course number
 * that prevent it from being readable within a Canvas course.
 */
function sanitizeCourseNumber(course) {
    // Pending removal - return course.replace(/[A-Z.]*/g, '');
    return course.replace(/[DF]/, '').replace(/[.]/, '');
}

/**
 * Use regular expressions to remove extra characters from a Banner course number
 * that prevent it from being readable within a Canvas course.
 */
function sanitizeSubjectCode(subject) {
    return subject.replace(/[ \/.]*/g, '');
}

// Module exports
module.exports = {
    abbreviateTermCode: abbreviateTermCode,
    concurrency: {
        SINGLE: {concurrency: 1},
        MULTI: {concurrency: 4}
    },
    sanitizeCourseNumber: sanitizeCourseNumber,
    sanitizeSubjectCode: sanitizeSubjectCode
};
