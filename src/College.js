'use strict';
let BannerOperations = require('./BannerOperations.js');
let CanvasApiClient = require('./CanvasApiClient.js');
let Common = require('./Common.js');
let Lodash = require('lodash');

/**
 * College.js describes an object type (and really a framework) that associates
 * a unique college specific configuration with the automation that needs to
 * happen both in Banner and Canvas. Dispatching all Canvas operations through
 * an instance of College ensures, among many things, that the correctly configured
 * API client is used.
 *
 * <p>In addition, this object serves as the starting point to create derived
 * objects through inheritance that can specify college implementations
 * for a member function.</b>
 * @license BSD-3-Clause
 */
class College {

    /**
     * Create a new instance of college
     @ @param {String} name Configured name of college
     */
    constructor(name) {
        // Load configuration by name
        this.config = require(`config`).get(`colleges.${name}`);

        // Load logger
        this.logger = require(`fhda-logging`).getLogger(`college-${name}`);

        // Create Canvas API client
        this.canvasApi = new CanvasApiClient(
            this.config.apiBaseUrl,
            this.config.apiKey);

        // Is this college enabled?
        this.enabled = this.config.enabled;

        // Set college name
        this.name = name;
    }

    /**
     * Create a new Canvas section in an existing course complete with
     * adding the latest enrollment from Banner, and ensuring both the section
     * and all enrollment records are tracked.
     * @param term {String} Banner term for the section
     * @param crn {String} Banner CRN for the section
     * @param canvasCourseId {String} Canvas course ID for the site
     * @param progress {Function} Optional progress tracker for monitoring the job
     */
    createSection(term, crn, canvasCourseId, progress) {
        let college = this;

        // Verify if the request refers to a tracked Banner course section
        return BannerOperations.isSectionTracked(term, crn, false)
            .then(() => {
                // Query the Banner section and enrollment records
                return [
                    BannerOperations.getCourseSection(term, crn),
                    BannerOperations.getSectionEnrollment(term, crn)];
            })
            .spread((bannerSection, bannerEnrollment) => {
                // Generate components for section name
                let sanitizedSubject = Common.sanitizeSubjectCode(bannerSection.subjectCode);
                let sanitizedCourseNumber = Common.sanitizeCourseNumber(bannerSection.courseNumber);

                // Update progress monitor if provided
                if(progress) {
                    progress.addTasks(bannerEnrollment.length);
                }

                // Create section in Canvas
                return [
                    bannerEnrollment,
                    college.canvasApi.createSection(
                        canvasCourseId,
                        `${sanitizedSubject} ${sanitizedCourseNumber}.${bannerSection.sectionNumber}`,
                        term,
                        crn)];
            })
            .spread((bannerEnrollment, canvasSection) => {
                // Track the Canvas section in Banner
                return BannerOperations.trackCourseSection(
                        term,
                        crn,
                        canvasSection.course_id,
                        canvasSection.id)
                    .return(bannerEnrollment);
            })
            .map(student => {
                // Update progress monitor if provided
                if(progress) {
                    progress.completeTask();
                }

                // Lookup student profile from Banner
                return BannerOperations.getPerson(student.pidm)
                    .then(person => {
                        // Enroll in Canvas, and track the student enrollment in Banner
                        return college.enrollStudent(term, crn, person);
                    });
            }, Common.concurrency.MULTI)
            .tap(() => {
                college.logger.info(`Successfully created and added section to Canvas course`, {term: term, crn: crn});
            });
    }

    /**
     * Delete a course section from an existing Canvas course.
     * @param term {String} Banner term for the section
     * @param crn {String} Banner CRN for the section
     * @param progress {Function} Optional progress tracker for monitoring the job
     */
    deleteSection(term, crn, progress) {
        let college = this;
        let trackedSection;

        // Verify if the request refers to a tracked Banner course section
        return BannerOperations.isSectionTracked(term, crn)
            .then(section => {
                // Retain section
                trackedSection = section;

                // Lookup enrollments in Canvas
                return college.canvasApi.getSectionEnrollment(section.sectionId);
            })
            .tap(enrollments => {
                // Update progress monitor if provided
                if(progress) {
                    progress.addTasks(enrollments.length);
                }
            })
            .map(enrollment => {
                // Delete each enrollment from Canvas, and untrack in Banner
                return Promise.all([
                    college.canvasApi.deleteStudent(enrollment),
                    BannerOperations.untrackEnrollment(enrollment)
                ])
                .tap(() => {
                    // Update progress monitor if provided
                    if(progress) {
                        progress.completeTask();
                    }

                    college.logger.info(`Successfully deleted student from Canvas section`, [{term: term, crn: crn}, enrollment]);
                });
            }, Common.concurrency.MULTI)
            .then(() => {
                // Delete the section from Canvas
                return college.canvasApi.deleteSection(trackedSection.sectionId);
            })
            .then(formerSection => {
                // Untrack section in Banner
                return BannerOperations.untrackCourseSection(formerSection.id).return(formerSection);
            })
            .tap(formerSection => {
                college.logger.info(`Successfully deleted section from Canvas course`, [{term: term, crn: crn}, formerSection]);
            });
    }

    /**
     * Drop a student from an existing course.
     * @param {String} term Banner term for the section
     * @param {String} crn Banner CRN for the section
     * @param {Number} pidm Banner PIDM of the student
     */
    dropStudent(term, crn, pidm) {
        let college = this;

        // Validate enrollment change is related to Canvas
        // Verify if the request refers to a tracked Banner enrollment
        return BannerOperations.isEnrollmentTracked(term, crn, pidm)
            .then(enrollment => {
                // Get the Canvas enrollment object
                return college.canvasApi.getEnrollment(enrollment.enrollmentId);
            })
            .tap(enrollment => {
                // Drop the student
                return college.canvasApi.dropStudent(enrollment);
            })
            .tap(formerEnrollment => {
                // Untrack the enrollment in Banner
                return BannerOperations.untrackEnrollment(formerEnrollment);
            })
            .tap(formerEnrollment => {
                console.log('DROP!');
                college.logger.info(`Successfully dropped student from Canvas section`, [{term: term, crn: crn}, formerEnrollment]);
            });
    }

    /**
     * Enroll a student into a Canvas course section, and add a tracked
     * enrollment record to Banner for reporting.
     * @param {String} term Banner term for the section
     * @param {String} crn Banner CRN for the section
     * @param {Object} person Identity of the student to add
     */
    enrollStudent(term, crn, person) {
        let college = this;

        college.logger.verbose('Preparing to enroll student in Canvas section', [{term: term, crn: crn}, person]);

        // Verify if the request refers to a tracked Banner course section
        return BannerOperations.isSectionTracked(term, crn)
            .then(section => {
                // Sync Canvas user profile
                return [section, college.canvasApi.syncUser(
                    person.campusId,
                    person.firstName,
                    person.lastName,
                    person.email)];
            })
            .spread((section, canvasProfile) => {
                college.logger.verbose('Validated requested section is in Canvas', [{term: term, crn: crn}, section, canvasProfile]);

                // Enroll student in Canvas Section
                return [
                    section,
                    canvasProfile,
                    college.canvasApi.enrollStudent(section.sectionId, canvasProfile.id)];
            })
            .spread((section, canvasProfile, enrollment) => {
                // Add tracked enrollment in Banner
                return [person, BannerOperations.trackEnrollment(
                    college,
                    term,
                    crn,
                    person.pidm,
                    canvasProfile.id,
                    'StudentEnrollment',
                    enrollment.id,
                    section.courseId,
                    section.sectionId)];
            })
            .tap(() => {
                college.logger.info(`Successfully enrolled student into Canvas section`, [{term: term, crn: crn}, person]);
            });
    }

    /**
     * Synchronize the enrollments of a student already expected to be enrolled
     * in one or more Canvas courses.
     * @param {String} term Banner term
     * @param {Object} person Identity of the student to check
     */
    syncStudent(term, person) {
        let college = this;
        let syncOps = [];

        college.logger.info(`Checking student enrollment synchronization`, [person, {term: term}]);

        // Lookup enrollments from Banner and Canvas
        return Promise.all([
            BannerOperations.getTrackedEnrollments(term, person.pidm),
            college.canvasApi.getCoursesForUser(term, person.campusId)])

        .spread((bannerEnrollments, canvasEnrollments) => {
            // Are there more enrollments in Banner than in Canvas?
            if(canvasEnrollments.length < bannerEnrollments.length) {
                college.logger.warn(`It appears that Canvas student adds are not in sync with Banner`, [person, {
                    term: term,
                    bannerCount: bannerEnrollments.length,
                    canvasCount: canvasEnrollments.length}]);

                // Iterate each Banner enrollment and manually force enroll the student in Canvas
                return Promise.each(bannerEnrollments, enrollment => {
                    syncOps.push(`Added missing student to course (Canvas course = ${enrollment.course_id}, term = ${term}, crn = ${enrollment.crn})`);
                    return college.canvasApi.enrollStudent(enrollment.sectionId, enrollment.userId);
                });
            }
            else if(canvasEnrollments.length > bannerEnrollments.length) {
                college.logger.warn(`It appears that Canvas student drops are not in sync with Banner`, [person, {
                    term: term,
                    bannerCount: bannerEnrollments.length,
                    canvasCount: canvasEnrollments.length}]);

                // Iterate each Canvas enrollment, but filter to only those not found in Banner
                return Promise.filter(canvasEnrollments, enrollment => {
                    return Lodash.find(bannerEnrollments, ['section_id', enrollment.id]) !== undefined;
                })
                // Iterate revised list of Canvas enrollments
                .each(enrollment => {
                    // Drop student from Canvas course
                    syncOps.push(`Dropped student from course (Canvas course = ${enrollment.course_id}, term = ${term}, crn = ${enrollment.crn})`);
                    return college.canvasApi.dropStudent(enrollment);
                });
            }
            college.logger.warn(`Student enrollment checks passed, and appear to be in sync`, [person, {term: term}]);
        })
        .then(() => {
            syncOps.push(`Sync completed for ${person.firstName} ${person.lastName}`);
            return syncOps;
        });
    }

}

module.exports = College;
