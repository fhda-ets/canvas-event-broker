'use strict';
let Banner = require('./BannerDatabase.js');
let Errors = require('./Errors.js');
let Jetpack = require('fs-jetpack');
let Logger = require('fhda-logging').getLogger('banner-operations');

// Load SQL statements
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
// const sqlLookupTestCourses = Jetpack.read('src/sql/LookupTestCourses.sql');
// const sqlRandomInstructors = Jetpack.read('src/sql/RandomInstructors.sql');
// const sqlRandomCanvasInstructors = Jetpack.read('src/sql/RandomCanvasInstructors.sql');
const sqlTrackCourseSection = Jetpack.read('src/sql/TrackCourseSection.sql');
const sqlTrackEnrollment = Jetpack.read('src/sql/TrackEnrollment.sql');
const sqlUntrackCourse = Jetpack.read('src/sql/UntrackCourse.sql');
const sqlUntrackCourseSection = Jetpack.read('src/sql/UntrackCourseSection.sql');
const sqlUntrackEnrollment = Jetpack.read('src/sql/UntrackEnrollment.sql');
const sqlUntrackTeacherEnrollments = Jetpack.read('src/sql/UntrackTeacherEnrollments.sql');

function deleteEvent(eventId) {
    return Banner
        .sql(sqlDeleteEvent, {eventId: eventId})
        .then(() => {
            Logger.verbose(`Deleted completed event ${eventId} from sync queue`);
        });
}

function getCourse(term, crn) {
    return Banner
        .sql(sqlGetCourse, {term: term, crn: crn})
        .then(Banner.unwrapObject)
        .tap(course => {
            Logger.debug(`Queried Banner course`, [{term: term, crn: crn}, course]);
        });
}

function getCourseSection(term, crn) {
    return Banner
        .sql(sqlGetCourseSection, {term: term, crn: crn})
        .then(Banner.unwrapObject)
        .tap(section => {
            Logger.debug(`Queried Banner section`, [{term: term, crn: crn}, section]);
        });
}

function getInstructors(term, crn) {
    return Banner
        .sql(sqlGetInstructors, {term: term, crn: crn})
        .then(Banner.unwrapRows);
}

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

function getPendingEvents() {
    return Banner
        .sql(sqlGetPendingEvents)
        .then(Banner.unwrapRows);
}

function getSectionEnrollment(term, crn) {
    return Banner
        .sql(sqlGetSectionEnrollment, {term: term, crn: crn})
        .then(Banner.unwrapRows);
}

function getTrackedEnrollments(term, pidm) {
    return Banner
        .sql(sqlGetTrackedEnrollments, {term: term, pidm: pidm})
        .then(Banner.unwrapRows);
}

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
