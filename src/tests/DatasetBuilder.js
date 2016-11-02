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
let Banner = require('../BannerDatabase.js');
let Logger = require('fhda-logging').getLogger('dataset-builder');
let Jetpack = require('fs-jetpack');

// Load SQL statements
const sqlLookupTestCourses = Jetpack.read('src/sql/LookupTestCourses.sql');
const sqlRandomInstructors = Jetpack.read('src/sql/RandomInstructors.sql');
const sqlRandomCanvasInstructors = Jetpack.read('src/sql/RandomCanvasInstructors.sql');

/**
 * Helper function to execute a query on Banner to lookup a random sample
 * of instructors and term codes from the SIRASGN table that can be used for
 * testing.
 * @return {Promise|Array} Fufilled with array of random sample of instructors and term codes
 */
function getRandomInstructors() {
    return Banner
        .sql(sqlRandomInstructors)
        .then(Banner.unwrapRows)
        .tap(instructors => {
            Logger.verbose(`Queried for list of random instructors and got ${instructors.length} candidates`);
        });
}

/**
 * Helper function to execute a query on Banner to lookup a random sample
 * of instructors who already have a site history creating and managing
 * Canvas courses.
 * @return {Promise|Array} Fufilled with array of random sample of instructors and term codes
 */
function getRandomCanvasInstructors() {
    return Banner
        .sql(sqlRandomCanvasInstructors)
        .then(Banner.unwrapRows)
        .tap(instructors => {
            Logger.verbose(`Queried for list of random instructors and got ${instructors.length} candidates`);
        });
}

function getTestCourses(college) {
    return Banner
        .sql(sqlLookupTestCourses, {college: college})
        .then(Banner.unwrapRows);
}

// Module exports
module.exports = {
    getRandomInstructors: getRandomInstructors,
    getRandomCanvasInstructors: getRandomCanvasInstructors,
    getTestCourses: getTestCourses
};
