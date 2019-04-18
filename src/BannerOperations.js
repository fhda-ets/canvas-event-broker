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
let Logger = require('fhda-pubsub-logging')('banner-operations');

// Load SQL statements
const sqlAllEnrollmentsByTerm = Jetpack.read('src/sql/AllEnrollmentsByTerm.sql');
const sqlCreateAdditionalId = Jetpack.read('src/sql/CreateAdditionalId.sql');
const sqlCreateCanvasFacultyAttribute = Jetpack.read('src/sql/InsertCanvasFacultyAttribute.sql');
const sqlCreateWebAuditRecord = Jetpack.read('src/sql/CreateWebAudit.sql');
const sqlCurrentTermsByCollege = Jetpack.read('src/sql/CurrentTermsByCollege.sql');
const sqlDeleteAdditionalId = Jetpack.read('src/sql/DeleteAdditionalId.sql');
const sqlDeleteEvent = Jetpack.read('src/sql/DeleteEvent.sql');
const sqlEnrollmentHistoryByTerm = Jetpack.read('src/sql/EnrollmentHistoryByTerm.sql');
const sqlGetBannerEnrollments = Jetpack.read('src/sql/BannerEnrollments.sql');
const sqlGetCourse = Jetpack.read('src/sql/Course.sql');
const sqlGetCourseSection = Jetpack.read('src/sql/CourseSection.sql');
const sqlGetInstructors = Jetpack.read('src/sql/Instructors.sql');
const sqlGetInstructorSchedule = Jetpack.read('src/sql/InstructorSchedule.sql');
const sqlGetPendingEvents = Jetpack.read('src/sql/PendingEvents.sql');
const sqlGetPerson = Jetpack.read('src/sql/Person.sql');
const sqlGetSectionEnrollment = Jetpack.read('src/sql/SectionEnrollment.sql');
const sqlGetTrackedEnrollments = Jetpack.read('src/sql/TrackedEnrollments.sql');
const sqlGetTrackedSectionById = Jetpack.read('src/sql/GetTrackedSectionById.sql');
const sqlIsEnrollmentTracked = Jetpack.read('src/sql/IsEnrollmentTracked.sql');
const sqlIsSectionTracked = Jetpack.read('src/sql/IsSectionTracked.sql');
const sqlTrackCourseSection = Jetpack.read('src/sql/TrackCourseSection.sql');
const sqlTrackEnrollment = Jetpack.read('src/sql/TrackEnrollment.sql');
const sqlUntrackCourse = Jetpack.read('src/sql/UntrackCourse.sql');
const sqlUntrackCourseSection = Jetpack.read('src/sql/UntrackCourseSection.sql');
const sqlUntrackCourseSectionByTermCrn = Jetpack.read('src/sql/UntrackCourseSectionByTermCrn.sql');
const sqlUntrackEnrollment = Jetpack.read('src/sql/UntrackEnrollment.sql');
const sqlUntrackTeacherEnrollments = Jetpack.read('src/sql/UntrackTeacherEnrollments.sql');

/**
 * Create a record for an additional ID in the Banner GORADID table.
 * @param {Number} pidm Banner PIDM identity for the user
 * @param {String} adidCode ADID code to distinguish the type of ID
 * @param {String} additionalId Value of the additional ID
 */
async function createAdditionalId(pidm, adidCode, additionalId) {
    await Banner.sql(sqlCreateAdditionalId, {
        pidm: pidm,
        adidCode: adidCode,
        additionalId: additionalId
    });

    Logger.info(`Created additional ID ${adidCode} -> ${additionalId} for PIDM ${pidm}`);
}

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
 * Delete an additional ID record for a person by the ADID code from the
 * Banner GORADID table.
 * @param {any} pidm Banner PIDM identity for the user
 * @param {any} adidCode ADID code to distinguish the type of ID
 */
async function deleteAdditionalId(pidm, adidCode) {
    await Banner.sql(sqlDeleteAdditionalId, {
        pidm: pidm,
        adidCode: adidCode
    });

    Logger.info(`Deleted additional ID ${adidCode} for PIDM ${pidm}`);
}

/**
 * Delete a sync event from the CANVASLMS_EVENTS table.
 * @param  {Object} event The event object to be deleted
 * @return {Promise} Resolved with database statement is completed
 */
function deleteEvent(event) {
    return Banner
        .sql(sqlDeleteEvent, {eventId: event.id})
        .then(() => {
            Logger.verbose(`Deleted completed event ${event.id} from sync queue`);
        });
}

/**
 * Get the enrollment history for a student based on the SFRSTCA audit table.
 * @param  {String} term Banner term code
 * @param  {Number} pidm Banner identity of the student
 * @return {Promise} Resolved when database query is completed
 */
function enrollmentHistoryByTerm(term, pidm) {
    return Banner
        .sql(sqlEnrollmentHistoryByTerm, {term: term, pidm: pidm})
        .then(Banner.unwrapRows);
}

async function getAllEnrollmentsByTerm(term) {
    let result = await Banner.sql(sqlAllEnrollmentsByTerm, {term: term});
    return result.rows;
}

/**
 * Lookup student enrollments from SFRSTCR joined with Canvas courses from
 * CANVALMS_SECTIONS.
 * @param  {String} term Banner term code
 * @param  {Number} pidm Banner identity of the student
 * @return {Promise} Resolved when database query is completed
 */
function getBannerEnrollments(term, pidm) {
    return Banner
        .sql(sqlGetBannerEnrollments, {term: term, pidm: pidm})
        .then(Banner.unwrapRows);
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
            Logger.debug(`Queried Banner course`, course);
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
            Logger.debug(`Queried Banner section`, section);
        });
}

/**
 * Lookup the current (and next) academic terms by college ID.
 * @param {String} collegeId The college to restrict the lookup by
 * @returns {Promise|Async} Resolved with the first row of the query
 */
async function getCurrentTermsByCollege(collegeId) {
    let result = await Banner.sql(sqlCurrentTermsByCollege, {collegeId: collegeId});
    return result.rows[0];
}

/**
 * Get a list of the instructors scheduled to teach a section in Banner.
 * @param  {String} term Banner term code
 * @param  {String} crn Banner CRN
 * @return {Promise} Resolved with database statement is completed
 */
async function getInstructors(term, crn) {
    try {
        let resultset = await Banner.sql(sqlGetInstructors, {term: term, crn: crn});
        return resultset.rows;
    }
    catch(error) {
        Logger.error(`Failed to get instructors for ${term}:${crn} - reason ${error.message}`);
        throw error;
    }
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
    Logger.debug('Preparing to query Banner for person identity', {
        identity: identity
    });
    
    // Check the type of identity provided
    if(identity === null || identity === undefined) {
        throw new Error(`'${identity}' is an invalid person identity object -- cannot complete lookup in Banner`);
    }
    else if(Number.isInteger(identity)) {
        Logger.debug('Querying Banner identity by PIDM (Number.isInteger)');

        // Execute query using a Banner PIDM
        return Banner
            .sql(sqlGetPerson, {pidm: identity, campusId: null})
            .then(Banner.unwrapObject);
    }
    else if(typeof identity === 'string') {
        Logger.debug('Querying Banner identity by string campus ID (typeof === string)');

        // Execute query using a campus ID/SPRIDEN_ID
        return Banner
            .sql(sqlGetPerson, {campusId: identity.trim(), pidm: null})
            .then(Banner.unwrapObject);
    }
    else if(identity.pidm) {
        Logger.debug('Querying Banner identity by numeric pidm (identity.pidm)');

        // Execute query using a Banner PIDM
        return Banner
            .sql(sqlGetPerson, {pidm: identity.pidm, campusId: null})
            .then(Banner.unwrapObject);
    }
    else if(identity.campusId) {
        Logger.debug('Querying Banner identity by string campus ID (identity.campusId)');

        // Execute query using a campus ID/SPRIDEN_ID
        return Banner
            .sql(sqlGetPerson, {campusId: identity.campusId.trim(), pidm: null})
            .then(Banner.unwrapObject);
    }
    else {
        throw new Error(`${identity} is an invalid person identity object -- cannot complete lookup in Banner`);
    }
}

/**
 * Get a list of the events waiting to be processed from the CANVASLMS_EVENTS
 * custom table.
 * @return {Promise} Resolved with an array of event objects
 */
function getPendingEvents(limit=1000) {
    return Banner
        .sql(sqlGetPendingEvents, {limit: limit})
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
 * Get a tracked section object from Banner based on the Canvas SIS section ID 
 * @param {String} sectionId
 * @returns Resolved with section object
 */
function getTrackedSectionById(sectionId) {
    return Banner
        .sql(sqlGetTrackedSectionById, {sectionId: sectionId})
        .then(Banner.unwrapObject);
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
 * @param  {Object} [options={}] One or more options to tune the behavior of the 
 * function. If the `rejectOnUntracked` property is to set to `true`, then an exception
 * will be thrown if the section appears untracked. If the `rejectOnDuplicates`
 * property is set to `true`, then an exception will be thrown if multiple records
 * are found for the CRN.
 * @return {Promise} Resolved with database statement is completed
 */
function isSectionTracked(term, crn, options={}) {
    // Apply option customizations to sensible default
    let finalOpts = Object.assign({
        rejectOnDuplicates: true,
        rejectOnUntracked: true
    }, options);

    return Banner
        .sql(sqlIsSectionTracked, {term: term, crn: crn})
        .then(Banner.unwrapRows)
        .then(rows => {
            Logger.debug(`Queried CANVASLMS_SECTIONS to verify term and CRN`, {
                result: rows
            });
            
            if(rows.length == 1){
                return rows[0];
            }
            else if(finalOpts.rejectOnDuplicates === true && rows.length > 1) {
                return Promise.reject(new Errors.DuplicateSections(`Cannot track a Canvas section that exists more than once in CANVASLMS_SECTIONS. This is likely an indicator of a serious problem`));
            }
            else if(finalOpts.rejectOnDuplicates === false && rows.length > 1) {
                return rows[0];
            }
            return (finalOpts.rejectOnUntracked === true) ? Promise.reject(new Errors.UntrackedSection()) : null;
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
function trackCourseSection(term, crn, courseId, sectionId, sisCourseId=null, sisSectionId=null) {
    // Create parameter payload
    let params = {
        term: term,
        crn: crn,
        sectionId: sectionId,
        courseId: courseId,
        sisCourseId: sisCourseId,
        sisSectionId: sisSectionId
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
        })
        .catch(error => {
            // Ignore unique constraint errors, but reject all others
            if(!(error.message.includes('(ETSIS.PK_CANVALMS_ENROLLMENTS) violated'))) {
                return Promise.reject(error);
            }
            Logger.warn('Ignored ETSIS.PK_CANVALMS_ENROLLMENTS unique constraint error on trackEnrollment(...)', params);
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
        courseId: course.id,
        term: course.sis_course_id.split(':')[0]
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
 * Remove a record for a tracked section from the CANVASLMS_SECTIONS custom table
 * @param  {String|Number} sectionId
 * @return {Promise} Resolved when the delete is completed
 */
function untrackCourseSectionByTermCrn(term, crn) {
    // Create parameter payload
    let params = { term: term, crn: crn };

    // Execute SQL
    return Banner.sql(sqlUntrackCourseSectionByTermCrn, params)
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

let circuitBreakerWebAudit = false;

function recordWebAudit(audience, action, payload) {
    if(circuitBreakerWebAudit) {
        // Do nothing because the circuit breaker was tripped
        return;
    }

    return Banner.sql(sqlCreateWebAuditRecord, {
        audience: audience,
        action: action,
        payload: JSON.stringify(payload)
    })
    .catch(error => {
        Logger.error(`Failed to record web audit record - ${error.message}`);
        circuitBreakerWebAudit = true;
    });
}

// Module exports
module.exports = {
    createAdditionalId: createAdditionalId,
    createCanvasFacultyAttribute: createCanvasFacultyAttribute,
    deleteAdditionalId: deleteAdditionalId,
    deleteEvent: deleteEvent,
    enrollmentHistoryByTerm: enrollmentHistoryByTerm,
    getAllEnrollmentsByTerm: getAllEnrollmentsByTerm,
    getBannerEnrollments: getBannerEnrollments,
    getCourse: getCourse,
    getCourseSection: getCourseSection,
    getCurrentTermsByCollege: getCurrentTermsByCollege,
    getInstructors: getInstructors,
    getInstructorSchedule: getInstructorSchedule,
    getPendingEvents: getPendingEvents,
    getPerson: getPerson,
    getSectionEnrollment: getSectionEnrollment,
    getTrackedEnrollments: getTrackedEnrollments,
    getTrackedSectionById: getTrackedSectionById,
    isEnrollmentTracked: isEnrollmentTracked,
    isSectionTracked: isSectionTracked,
    recordWebAudit: recordWebAudit,
    trackCourseSection: trackCourseSection,
    trackEnrollment: trackEnrollment,
    untrackCourse: untrackCourse,
    untrackCourseSection: untrackCourseSection,
    untrackCourseSectionByTermCrn: untrackCourseSectionByTermCrn,
    untrackEnrollment: untrackEnrollment,
    untrackTeacherEnrollments: untrackTeacherEnrollments
};
