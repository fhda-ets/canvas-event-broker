/**
 * Custom error types.
 * @license BSD-3-Clause
 * @module
 */

'use strict';
let ExtendableError = require('es6-error');

/**
 * Thrown if a section appears more than once in the CANVASLMS_SECTIONS custom
 * table for Banner.
 * @license BSD-3-Clause
 */
class DuplicateSectionsError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

/**
 * Thrown if an enrollment does not exist in the CANVASLMS_ENROLLMENTS custom
 * table for Banner.
 * @license BSD-3-Clause
 */
class UntrackedEnrollmentError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

/**
 * Thrown if a section does not exist in the CANVASLMS_SECTIONS custom
 * table for Banner.
 * @license BSD-3-Clause
 */
class UntrackedSectionError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

module.exports = {
    DuplicateSections: DuplicateSectionsError,
    UntrackedEnrollment: UntrackedEnrollmentError,
    UntrackedSection: UntrackedSectionError
};
