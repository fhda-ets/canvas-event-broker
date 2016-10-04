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
