/**
 * Separates the higher-level work of loading SQL statements into memory, and
 * the useful functions for executing those statements safely with bind parameters.
 * @license BSD-3-Clause
 * @module
 */

'use strict';
let Banner = require('./BannerDatabase.js');
let Errors = require('./Errors.js');
let Jetpack = require('fs-jetpack');
let Logger = require('fhda-logging').getLogger('banner-operations');

// Load SQL statements
const sqlCreateCanvasFacultyAttribute = Jetpack.read('src/sql/InsertCanvasFacultyAttribute.sql');
const sqlDeleteEvent = Jetpack.read('src/sql/DeleteEvent.sql');
const sqlGetCourse = Jetpack.read('src/sql/Course.sql');
const sqlGetCourseSection = Jetpack.read('src/sql/CourseSection.sql');
const sqlGetInstructors = Jetpack.read('src/sql/Instructors.sql');
const sqlGetInstructorSchedule = Jetpack.read('src/sql/InstructorSchedule.sql');
const sqlGetPendingEvents = Jetpack.read('src/sql/PendingEvents.sql');
const sqlGetPerson = Jetpack.read('src/sql/Person.sql');
const sqlGetSectionEnrollment = Jetpack.read('src/sql/SectionEnrollment.sql');
const sqlGetTrackedEnrollments = Jetpack.read('src/sql/TrackedEnrollments.sql');
const sqlIsEnrollmentTracked = Jetpack.read('src/sql/IsEnrollmentTracked.sql');
const sqlIsSectionTracked = Jetpack.read('src/sql/IsSectionTracked.sql');
const sqlTrackCourseSection = Jetpack.read('src/sql/TrackCourseSection.sql');
const sqlTrackEnrollment = Jetpack.read('src/sql/TrackEnrollment.sql');
const sqlUntrackCourse = Jetpack.read('src/sql/UntrackCourse.sql');
const sqlUntrackCourseSection = Jetpack.read('src/sql/UntrackCourseSection.sql');
const sqlUntrackEnrollment = Jetpack.read('src/sql/UntrackEnrollment.sql');
const sqlUntrackTeacherEnrollments = Jetpack.read('src/sql/UntrackTeacherEnrollments.sql');

/**
 * Create a CANV attribute in the Banner baseline table SIRATTR to indicate
 * that the instructor has received college approved Canvas training.
 * @param  {Number} pidm Banner PIDM identity for the instructor
 * @return {Promise} Resolved with database statement is completed
 */
function createCanvasFacultyAttribute(pidm) {
    return Banner
        .sql(sqlCreateCanvasFacultyAttribute, {pidm: pidm})
        .then(() => {
            Logger.info(`Created Canvas CANV faculty attribute for PIDM ${pidm}`);
        })
        .catch(error => {
            if(error.message.includes('ORA-00001')) {
                Logger.warn(`Did not create CANV faculty attribute for PIDM ${pidm} because it already existed`);
                return Promise.resolve();
            }
            return Promise.reject(error);
        });
}

/**
 * Delete a sync event from the CANVASLMS_EVENTS table.
 * @param  {Number} eventId ID of the event to delete
 * @return {Promise} Resolved with database statement is completed
 */
function deleteEvent(eventId) {
    return Banner
        .sql(sqlDeleteEvent, {eventId: eventId})
        .then(() => {
            Logger.verbose(`Deleted completed event ${eventId} from sync queue`);
        });
}

/**
 * Get a course object from Banner (join across SSBSECT and SCBCRSE)
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with database statement is completed
 */
function getCourse(term, crn) {
    return Banner
        .sql(sqlGetCourse, {term: term, crn: crn})
        .then(Banner.unwrapObject)
        .tap(course => {
            Logger.debug(`Queried Banner course`, [{term: term, crn: crn}, course]);
        });
}

/**
 * Get a section object from Banner (exclusively SSBSECT)
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with database statement is completed
 */
function getCourseSection(term, crn) {
    return Banner
        .sql(sqlGetCourseSection, {term: term, crn: crn})
        .then(Banner.unwrapObject)
        .tap(section => {
            Logger.debug(`Queried Banner section`, [{term: term, crn: crn}, section]);
        });
}

/**
 * Get a list of the instructors scheduled to teach a section in Banner.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with database statement is completed
 */
function getInstructors(term, crn) {
    return Banner
        .sql(sqlGetInstructors, {term: term, crn: crn})
        .then(Banner.unwrapRows);
}

/**
 * Get a list of scheduled teaching assignments for a specific instructor in Banner.
 * @param  {String} term Banner term code
 * @param  {String} instructorId SPRIDEN_ID for the instructor
 * @return {Promise} Resolved with database statement is completed
 */
function getInstructorSchedule(term, instructorId) {
    return Banner
        .sql(sqlGetInstructorSchedule, {instructorId: instructorId, term: term})
        .then(Banner.unwrapRows)
        .tap(assignments => {
            Logger.debug(`Queried Banner instructor schedule`, {
                instructorId: instructorId,
                term: term,
                assignmentCount: assignments.length});
        });
}

/**
 * Get a person object from Banner. Different types of identity specifications
 * can be passed in making this versatile function.
 * @param  {Object|Number} identity If number, then treated as a Banner PIDM. If
 * an object, then it is checked first for a pidm property, and or a campusId
 * property with a Banner SPRIDEN_ID.
 * @return {Promise} Resolved with a person object if found, when the
 * database statement is completed.
 */
function getPerson(identity) {
    // Check the type of identity provided
    if(Number.isInteger(identity)) {
        // Execute query using a Banner PIDM
        return Banner
            .sql(sqlGetPerson, {pidm: identity, campusId: null})
            .then(Banner.unwrapObject);
    }
    else if(identity.pidm) {
        // Execute query using a Banner PIDM
        return Banner
            .sql(sqlGetPerson, Object.assign(identity, {campusId: null}))
            .then(Banner.unwrapObject);
    }
    else if(identity.campusId) {
        // Execute query using a campus ID/SPRIDEN_ID
        return Banner
            .sql(sqlGetPerson, Object.assign(identity, {pidm: null}))
            .then(Banner.unwrapObject);
    }
}

/**
 * Get a list of the events waiting to be processed from the CANVASLMS_EVENTS
 * custom table.
 * @return {Promise} Resolved with an array of event objects
 */
function getPendingEvents() {
    return Banner
        .sql(sqlGetPendingEvents)
        .then(Banner.unwrapRows);
}

/**
 * Get a list of the enrolled students in a section from baseline table SFRSTCR.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with an array of enrolled students in the section
 */
function getSectionEnrollment(term, crn) {
    return Banner
        .sql(sqlGetSectionEnrollment, {term: term, crn: crn})
        .then(Banner.unwrapRows);
}

/**
 * Get a list of the tracked Canvas enrollments from the CANVASLMS_ENROLLMENTS
 * custom table.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with an array of enrolled students in the section
 */
function getTrackedEnrollments(term, pidm) {
    return Banner
        .sql(sqlGetTrackedEnrollments, {term: term, pidm: pidm})
        .then(Banner.unwrapRows);
}

/**
 * Checks the CANVASLMS_ENROLLMENTS custom table to see if an enrollment is
 * tracked.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @param  {Number} pidm Banner PIDM for the student or instructor
 * @return {Promise} Resolved with the enrollment object if found, or rejected
 * with an UntrackedEnrollment error.
 */
function isEnrollmentTracked(term, crn, pidm) {
    return Banner
        .sql(sqlIsEnrollmentTracked, {term: term, crn: crn, pidm: pidm})
        .then(Banner.unwrapRows)
        .then(rows => {
            Logger.debug(`Queried CANVASLMS_ENROLLMENTS to verify term, CRN, and PIDM`, rows);
            if(rows.length == 1){
                return rows[0];
            }
            return Promise.reject(new Errors.UntrackedEnrollment());
        });
}

/**
 * Checks the CANVASLMS_SECTIONS custom table to see if a section is
 * tracked as being part of a Canvas course.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @param  {Boolean} [rejectOnUntracked=true] If true, function will return a
 * rejected promise if not found. If false, function will resolve with a null value;
 * @return {Promise} Resolved with database statement is completed
 */
function isSectionTracked(term, crn, rejectOnUntracked=true) {
    return Banner
        .sql(sqlIsSectionTracked, {term: term, crn: crn})
        .then(Banner.unwrapRows)
        .then(rows => {
            Logger.debug(`Queried CANVASLMS_SECTIONS to verify term and CRN`, rows);
            if(rows.length == 1){
                return rows[0];
            }
            else if(rows.length > 1) {
                return Promise.reject(new Errors.DuplicateSections(`Cannot track a Canvas section that exists more than once in CANVASLMS_SECTIONS. This is likely an indicator of a serious problem`));
            }
            return (rejectOnUntracked) ? Promise.reject(new Errors.UntrackedSection()) : null;
        });
}

/**
 * Create a new record to track a section in the CANVASLMS_SECTIONS custom table.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @param  {Number} courseId Canvas course ID
 * @param  {Number} sectionId Canvas section ID
 * @return {Promise} Resolved when the insert is completed
 */
function trackCourseSection(term, crn, courseId, sectionId) {
    // Create parameter payload
    let params = {
        term: term,
        crn: crn,
        sectionId: sectionId,
        courseId: courseId
    };

    // Execute SQL
    return Banner.sql(sqlTrackCourseSection, params)
        .then(() => {
            Logger.verbose('Added tracked Canvas course section to Banner', params);
        });
}

/**
 * Create a new record to track a Canvas enrollment (instructor or students)
 * in the CANVASLMS_ENROLLMENTS custom table.
 * @param  {Object} college College object related to the enrollment
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @param  {Number} pidm Banner PIDM identity for the person
 * @param  {Number} userId Canvas user ID
 * @param  {String} enrollmentType Type of Canvas enrollment
 * @param  {Number} enrollmentId Canvas enrollment ID
 * @param  {Number} courseId Canvas course ID
 * @param  {Number} sectionId Canvas section ID
 * @return {Promise} Resolved when the insert is completed
 */
function trackEnrollment(college, term, crn, pidm, userId, enrollmentType, enrollmentId, courseId, sectionId) {
    // Create parameter payload
    let params = {
        term: term,
        crn: crn,
        pidm: pidm,
        userId: userId,
        type: enrollmentType,
        enrollmentId: enrollmentId,
        courseId: courseId,
        sectionId: sectionId || -1,
        url: `${college.config.canvasUrl}/courses/${courseId}`
    };

    // Execute SQL
    return Banner.sql(sqlTrackEnrollment, params)
        .then(() => {
            Logger.verbose('Added tracked Canvas enrollment to Banner', params);
        });
}

/**
 * Remove all records for a tracked course from the CANVASLMS_SECTIONS custom table
 * @param  {Object} course Canvas course object
 * @return {Promise} Resolved when the delete is completed
 */
function untrackCourse(course) {
    // Create parameter payload
    let params = {
        courseId: course.id
    };

    // Execute SQL
    return Banner.sql(sqlUntrackCourse, params)
        .then(() => {
            Logger.verbose('Removed tracked Canvas course from Banner', params);
        });
}

/**
 * Remove a record for a tracked section from the CANVASLMS_SECTIONS custom table
 * @param  {String|Number} sectionId
 * @return {Promise} Resolved when the delete is completed
 */
function untrackCourseSection(sectionId) {
    // Create parameter payload
    let params = {
        sectionId: sectionId
    };

    // Execute SQL
    return Banner.sql(sqlUntrackCourseSection, params)
        .then(() => {
            Logger.verbose('Removed tracked Canvas course section from Banner', params);
        });
}

/**
 * Remove a record for a tracked enrollment from the CANVASLMS_ENROLLMENTS custom table
 * @param  {Object} enrollment Canvas enrollment object
 * @return {Promise} Resolved when the delete is completed
 */
function untrackEnrollment(enrollment) {
    // Create parameter payload
    let params = {
        enrollmentId: enrollment.id
    };

    // Execute SQL
    return Banner.sql(sqlUntrackEnrollment, params)
        .then(() => {
            Logger.info('Removed tracked Canvas enrollment from Banner', params);
        });
}

/**
 * Remove all records for tracked instructor enrollments from the CANVALMS_ENROLLMENTS
 * custom table.
 * @param  {Object} course Canvas course object
 * @return {Promise} Resolved when the delete is completed
 */
function untrackTeacherEnrollments(course) {
    // Create parameter payload
    let params = {
        courseId: course.id
    };

    // Execute SQL
    return Banner.sql(sqlUntrackTeacherEnrollments, params)
        .then(() => {
            Logger.verbose('Removed tracked Canvas teacher enrollments from Banner', params);
        });
}

// Module exports
module.exports = {
    createCanvasFacultyAttribute: createCanvasFacultyAttribute,
    deleteEvent: deleteEvent,
    getCourse: getCourse,
    getCourseSection: getCourseSection,
    getInstructors: getInstructors,
    getInstructorSchedule: getInstructorSchedule,
    getPendingEvents: getPendingEvents,
    getPerson: getPerson,
    getSectionEnrollment: getSectionEnrollment,
    getTrackedEnrollments: getTrackedEnrollments,
    isEnrollmentTracked: isEnrollmentTracked,
    isSectionTracked: isSectionTracked,
    trackCourseSection: trackCourseSection,
    trackEnrollment: trackEnrollment,
    untrackCourse: untrackCourse,
    untrackCourseSection: untrackCourseSection,
    untrackEnrollment: untrackEnrollment,
    untrackTeacherEnrollments: untrackTeacherEnrollments
};
