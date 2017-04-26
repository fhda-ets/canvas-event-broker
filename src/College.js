'use strict';
let BannerOperations = require('./BannerOperations.js');
let CanvasApiClient = require('./CanvasApiClient.js');
let Common = require('./Common.js');
let CronJob = require('cron').CronJob;
let Jetpack = require('fs-jetpack');
let Lodash = require('lodash');
let Moment = require('moment');

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
        this.logger = require(`fhda-pubsub-logging`)(`college-${name}`);

        // Create Canvas API client
        this.canvasApi = new CanvasApiClient(
            this.config.apiBaseUrl,
            this.config.apiKey);

        // Is this college enabled?
        this.enabled = this.config.enabled;

        // Set college name
        this.name = name;

        // Set up any defined scheduled jobs
        if(this.config.scheduledJobs) {
            this.scheduledJobs = new Set();
            
            // Iterate each job configuration
            for(let [cron, moduleName] of Object.entries(this.config.scheduledJobs)) {        

                // Create cron job and add to internal collection
                this.scheduledJobs.add(new CronJob({
                    cronTime: cron,
                    onTick: require(`./scheduled-jobs/${moduleName}`),
                    context: this,
                    start: true
                }));

                this.logger.info(`Created scheduled job ${moduleName} with cron expression ${cron}`);
            }
        }
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
     * @param {Object} enrollment Optionally, provide a Canvas enrollment, and this allows for a drop express lane
     */
    async dropStudent(term, crn, pidm, enrollmentBypass=undefined) {
        let college = this;
        let canvasEnrollment = enrollmentBypass;

        try {
            // Is an enrollment bypass specified? If so, enter the express lane for drop
            if(canvasEnrollment !== undefined) {
                // Drop the student from Canvas
                await college.canvasApi.dropStudent(enrollmentBypass);

                // Drop the enrollment record in Banner
                await BannerOperations.untrackEnrollment(enrollmentBypass);

                college.logger.info(`Successfully dropped student from Canvas section`, [{term: term, crn: crn}, enrollmentBypass]);
            }
            else {
                // Validate enrollment change is related to Canvas
                // Verify if the request refers to a tracked Banner enrollment
                let trackedEnrollment = await BannerOperations.isEnrollmentTracked(term, crn, pidm);

                // Get the Canvas enrollment object                
                canvasEnrollment = await college.canvasApi.getEnrollment(trackedEnrollment.enrollmentId);

                // Drop the student
                await college.canvasApi.dropStudent(canvasEnrollment);

                // Drop the enrollment record in Banner
                await BannerOperations.untrackEnrollment(canvasEnrollment);

                college.logger.info(`Successfully dropped student from Canvas section`, [{term: term, crn: crn}, canvasEnrollment]);
            }
        }
        catch(error) {
            if(error.name === 'StatusCodeError' && error.statusCode === 404) {
                // The requested enrollment was not found in Canvas so untrack it
                college.logger.warn(`Could not drop student because requested enrollment was not found`, [{term: term, crn: crn}, canvasEnrollment]);
                await BannerOperations.untrackEnrollment(canvasEnrollment);
            }
            throw error;
        }
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

        college.logger.verbose('Preparing to enroll student in Canvas section', { 
            term: term,
            crn: crn,
            person: person
        });

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
                college.logger.verbose('Validated requested section is in Canvas', {
                    term: term,
                    crn: crn,
                    section: section,
                    canvasProfile: canvasProfile
                });

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
                college.logger.info(`Successfully enrolled student into Canvas section`, {
                    term: term,
                    crn: crn,
                    person: person
                });
            });
    }

    /**
     * Practically a miniature program, this routine scans both Banner and Canvas
     * enrollments for the current academic periods, identifies discrepanies
     * for students who should be in a Canvas course, and those who dropped
     * the section and no longer belong. Changes are then applied to the Canvas
     * course to bring the rosters into alignment. The goal, when this routine is
     * running properly, Banner and Canvas rosters should match 100%.
     * @returns {Promise} Resolved when the reconciliation run has completed without errors
     */
    async reconcileEnrollment() {
        this.logger.info('Preparing to reconcile enrollment');

        // Ensure reconciliation output directory exists
        Jetpack.dir('reconciliation-reports');

        // Define collection of final reports for each term
        let finalReports = [];

        // Lookup current academic terms
        let terms = await BannerOperations.getCurrentTermsByCollege(this.config.collegeId);
        this.logger.verbose('Query current academic terms', terms);

        // Iterate over the current and next academic terms
        for(let term of [terms.term, terms.nextTerm]) {
            // Check to ensure the term is not blacklisted
            if(this.config.reconciliation !== undefined) {
                if(this.config.reconciliation.blacklistTerms !== undefined) {
                    if(this.config.reconciliation.blacklistTerms.includes(term)) {
                        this.logger.info(`Skipping reconcile of enrollment for term ${term} -- term is configured as blacklisted`);
                        continue;
                    }
                }
            }
            this.logger.info(`Reconciling enrollment for term ${term}`);

            // Get Canvas enrollment term object
            let enrollmentTerm = await this.canvasApi.getEnrollmentTermBySisId(term);
            if(enrollmentTerm === undefined) {
                // Skip
                this.logger.info(`Skipping reconcile of enrollment for term ${term} -- no matching Canvas enrollment term`);
                continue;
            }
            this.logger.verbose(`Found Canvas enrollment term ${enrollmentTerm.id} for ${term}`, enrollmentTerm);
            
            // Get Canvas courses
            this.logger.verbose(`Querying available courses`, terms);
            let courses = await this.canvasApi.getCoursesForEnrollmentTerm(enrollmentTerm.id);
            this.logger.verbose(`Found ${courses.length} Canvas courses for reconciliation`);

            // Run a huge transform to list all enrollments for Canvas in each course
            let canvasEnrollments = await Promise
                .filter(courses, course => course.sis_course_id !== null)
                .map(course => this.canvasApi.getCourseEnrollment(course.id), { concurrency: 16 })
                .then(enrollmentGroups => Lodash.flattenDeep(enrollmentGroups))
                .filter(enrollment => enrollment.sis_section_id !== null)
                .map(enrollment => {
                    let parsedSisId = enrollment.sis_section_id.split(/:/);
                    enrollment.bannerTerm = parsedSisId[0];
                    enrollment.bannerCrn = parsedSisId[1];
                    return enrollment;
                });

            // Collect all of the Banner enrollment for known Canvas courses in the current term
            let bannerEnrollments = await BannerOperations.getAllEnrollmentsByTerm(term);

            // Log a report of the initial findings
            this.logger.info(`Completed data gathering for enrollment reconciliation`, {
                enrollmentTerm: enrollmentTerm,
                banner: {
                    enrollmentCount: bannerEnrollments.length,
                    sample: bannerEnrollments[0]
                },
                canvas: {
                    enrollmentCount: canvasEnrollments.length,
                    sample: canvasEnrollments[0]
                }
            });

            // Build reconciliation report for web client
            let report = {
                term: enrollmentTerm,
                bannerEnrollmentCount: bannerEnrollments.length,
                canvasEnrollmentCount: canvasEnrollments.length,
                enrollments: {
                    missing: 0,
                    corrected: 0
                },

                drops: {
                    missing: 0,
                    corrected: 0
                }
            };

            // Identify registered students who are missing from Canvas
            for(let bannerEnrollment of bannerEnrollments) {
                // Search for enrollment match
                let enrolledInCanvas = Lodash.find(canvasEnrollments, {
                    bannerTerm: bannerEnrollment.term,
                    bannerCrn: bannerEnrollment.crn,
                    sis_user_id: bannerEnrollment.campusId
                }) !== undefined;

                // If the Canvas enrollment is not found, then the student should be marked for add
                if(enrolledInCanvas === false) {
                    report.enrollments.missing++;

                    this.logger.info(`Reconcilation needed to enroll ${bannerEnrollment.campusId} in Canvas section ${bannerEnrollment.term}:${bannerEnrollment.crn}`);

                    // Lookup person by PIDM
                    let person = await BannerOperations.getPerson(bannerEnrollment.pidm);

                    // Enroll student in Canvas
                    await this.enrollStudent(
                        bannerEnrollment.term,
                        bannerEnrollment.crn,
                        person);

                    report.enrollments.corrected++;
                }
            }

            // Identify active Canvas students who are not registered students in the matching Banner section
            for(let canvasEnrollment of canvasEnrollments) {
                // Search for enrollment match
                let enrolledInBanner = Lodash.find(bannerEnrollments, {
                    term: canvasEnrollment.bannerTerm,
                    crn: canvasEnrollment.bannerCrn,
                    campusId: canvasEnrollment.sis_user_id
                }) !== undefined;

                // If the Banner enrollment is not found, then the student should be marked for drop
                if(enrolledInBanner === false) {
                    report.drops.missing++;

                    this.logger.info(`Reconcilation needed to drop ${canvasEnrollment.sis_user_id} from Canvas section ${canvasEnrollment.bannerTerm}:${canvasEnrollment.bannerCrn}`, canvasEnrollment);

                    // Drop student from Canvas
                    await this.dropStudent(
                        canvasEnrollment.bannerTerm,
                        canvasEnrollment.bannerCrn,
                        null,
                        canvasEnrollment);

                    report.drops.corrected++;
                }
            }

            // Add term report to collection
            finalReports.push(report);

            // Write larger reconcilaition report for archiving
            Jetpack.write(`reconciliation-reports/reconciliation-${term}-${Moment().format('MMM-D-YYYY-hh-mm-a')}.json`, {
                report: report,
                bannerEnrollment: bannerEnrollments,
                canvasEnrollment: canvasEnrollments
            });
            
            // Keep only the last 6 reconciliation reports per college
            Jetpack.find('reconciliation-reports', {matching: `./*-*${term[5]}-*.json`})
                .map(path => Object.assign(Jetpack.inspect(path, {times: true}), { path: path }))
                .sort((a, b) => a.modifyTime.milliseconds - b.modifyTime.milliseconds)
                .slice(0, -6)
                .forEach(oldestFile => {
                    this.logger.info(`Removing old reconciliation report ${oldestFile.path}`);
                    Jetpack.remove(oldestFile.path);
                });

            this.logger.info(`Completed enrollment reconciliation for ${term}`);
        }

        // Return collection of completed reconciliation reports
        return finalReports;
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

        // Ensure Canvas account is sychronized
        // @date Jan-9-2017
        return college.canvasApi.syncUser(
            person.campusId,
            person.firstName,
            person.lastName,
            person.email)

        .then(() => Promise.all([
            // Lookup enrollments from Banner
            BannerOperations.enrollmentHistoryByTerm(term, person.pidm),

            // Lookup enrollments from Canvas (with reduction Banner term and CRN)
            college.canvasApi.getEnrollmentsForUser(term, person.campusId)
        ]))                
        
        .spread((bannerEnrollments, canvasEnrollments) => {
            college.logger.info('Queried Banner and Canvas enrollments for student prior to sync', {
                banner: bannerEnrollments,
                canvas: canvasEnrollments,
                person: person
            });

            // Iterate enrollments to identify possible problems
            return Promise.all([
                // Check for student adds that should be repaired
                Promise
                    .filter(bannerEnrollments, enrollment => enrollment.registrationStatus[0] === 'R')
                    .each(enrollment => {
                        // Enroll student in Canvas course                                            
                        return this
                            .enrollStudent(term, enrollment.crn, person)
                            .then(() => syncOps.push(`Added student to course (term = ${term}, crn = ${enrollment.crn})`))
                            .catch(error => {
                                college.logger.error('Error dump', error);
                                if(!(error.message.includes('unique constraint (ETSIS.PK_CANVALMS_ENROLLMENTS) violated'))) {
                                    syncOps.push(`Failed to missing student to course (error = ${error.message}, term = ${term}, crn = ${enrollment.crn})`);
                                }
                            });
                    }),

                // Check for student drops that should be repaired
                Promise.each(canvasEnrollments, canvasEnrollment => {
                    let hasMatchingBannerDrop = Lodash.find(bannerEnrollments, bannerEnrollment => {
                        return (bannerEnrollment.term === canvasEnrollment.bannerTerm
                            && bannerEnrollment.crn === canvasEnrollment.bannerCrn
                            && (bannerEnrollment.registrationStatus[0] === 'D' || bannerEnrollment.registrationStatus[0] === 'I' || bannerEnrollment.registrationStatus[0] === 'P'));
                    });

                    if(hasMatchingBannerDrop) {
                        // Drop student from Canvas course
                        return college.canvasApi
                            .dropStudent(canvasEnrollment)
                            .then(() => syncOps.push(`Dropped student from course (Canvas course = ${canvasEnrollment.course_id}, term = ${canvasEnrollment.bannerTerm}, crn = ${canvasEnrollment.bannerCrn})`));
                    }
                })
            ]);
        })
        .then(() => {
            syncOps.push(`Sync completed for ${person.firstName} ${person.lastName}`);
            return syncOps;
        });
    }
    
}

module.exports = College;
