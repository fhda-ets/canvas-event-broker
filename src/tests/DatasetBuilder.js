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
