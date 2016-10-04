'use strict';
let ExtendableError = require('es6-error');

class DuplicateSectionsError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

class UntrackedEnrollmentError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

class UntrackedSectionError extends ExtendableError {
    constructor(message) {
        super(message);
    }
}

// Module exports
module.exports = {
    DuplicateSections: DuplicateSectionsError,
    UntrackedEnrollment: UntrackedEnrollmentError,
    UntrackedSection: UntrackedSectionError
};
