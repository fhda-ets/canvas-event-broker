'use strict';
let Common = require('./Common.js');
let Logger = require('fhda-pubsub-logging')('canvas-api-client');
let LoggerHttp = require('fhda-pubsub-logging')('canvas-api-client-http');
let Random = require('random-gen');
let Request = require('request-promise');

// Configure request-debug to instrument HTTP traffic
require('request-debug')(Request, function(type, data) {
    if(type === 'request') {
        LoggerHttp.debug(`Dispatching ${data.method} request to ${data.uri}`, {debugId: data.debugId});
    }
    else if(type === 'response') {
        LoggerHttp.debug(`Received response`, {
            debugId: data.debugId,
            statusCode: data.statusCode
        });

        LoggerHttp.debug(`Response body for request ID ${data.debugId}`, data.body);
    }
});

/**
 * Provides a high-level wrapper around the Canvas REST API.
 * See also https://api.instructure.com
 * @license BSD-3-Clause
 */
class CanvasApiClient {

    /**
     * Create a new API client instance
     * @param {String} baseUrl Root URL of the Canvas instance
     * @param {String} apiKey Permanent OAuth API key to use for authenticating requests
     */
    constructor(baseUrl, apiKey) {
        // Create the Request HTTP client
        this.client = Request.defaults({
            baseUrl: baseUrl,
            headers: {
                Authorization: `Bearer ${apiKey}`
            },
            json: true,
            simple: true,
            time: true,
            timeout: 20000,
            transform: (body, response) => {
                // Track Canvas API usage
                Logger.info(`Canvas API usage`, {
                    rateLimitRemain: parseFloat(response.headers['x-rate-limit-remaining']),
                    requestCost: parseFloat(response.headers['x-request-cost'])
                });

                return body;
            }
        });
    }

    /**
     * User accounts
     */

    /**
     * Lookup a user account profile in Canvas.
     * @param {String} sisLoginId Banner login identity for the person
     * @returns {Promise} Resolved with the Canvas user profile object
     */
    getUser(userId, type='sis_login_id:') {
        return this.client
            .get(`/users/${type}${userId}/profile`)
            .promise()
            .catch(error => {
                if(error.statusCode === 404) {
                    Logger.verbose(`Could not find user profile in Canvas`, {type: type, userId: userId});
                    return null;
                }
                return Promise.reject(error);
            });
    }

    /**
     * Create or update a user account in Canvas with the minimum viable
     * attributes for the SIS login ID, first name, last name, and a contact
     * e-mail address. Tries to avoid unnecessary operations if the Canvas
     * account already appears to be in sync with the values provided.
     * @param {String} sisLoginId Banner login identity for the person
     * @param {String} firstName First name from Banner
     * @param {String} lastName Last name from Banner
     * @param {String} email Contact e-mail address from Banner
     * @returns {Promise} Resolved with the Canvas user profile object after the update
     */
    syncUser(sisLoginId, firstName, lastName, email) {
        let parent = this;

        Logger.info(`Preparing to sync Canvas account`, {
            campusId: sisLoginId
        });

        return this.getUser(sisLoginId)
            .then(profile => {
                if(profile === null) {
                    // Create new account
                    return parent.createUser(sisLoginId, firstName, lastName, email);
                }
                else if(profile.name !== `${firstName} ${lastName}` || profile.sortable_name !== `${lastName}, ${firstName}`) {
                    // Sync account due to name change
                    return parent.updateUser(sisLoginId, firstName, lastName, email);
                }
                else if(profile.primary_email !== email) {
                    // Sync account due to e-mail change
                    return parent.updateUser(sisLoginId, firstName, lastName, email);
                }
                return profile;
            });
    }

    createUser(sisLoginId, firstName, lastName, email) {
        Logger.info(`Creating new Canvas accont`, {
            sisLoginId: sisLoginId,
            firstName: firstName,
            lastName: lastName,
            email: email
        });

        return this.client({
            method: `POST`,
            uri: `/accounts/1/users`,
            form: {
                'user[name]': `${firstName} ${lastName}`,
                'user[short_name]': `${firstName} ${lastName}`,
                'user[sortable_name]': `${lastName}, ${firstName}`,
                'user[skip_registration]': 'true',
                'user[terms_of_use]': 'true',
                'pseudonym[unique_id]': sisLoginId,
                'pseudonym[sis_user_id]': sisLoginId,
                'pseudonym[skip_confirmation]': 'true',
                'enable_sis_reactivation': 'true',
                'communication_channel[address]': (email) ? email : 'missingemail@fhda.edu',
                'communication_channel[type]': 'email',
                'communication_channel[skip_confirmation]': 'true'
            }
        })
        .catch(error => {
            Logger.error(`Failed to create new Canvas account`, [error, {
                sisLoginId: sisLoginId,
                firstName: firstName,
                lastName: lastName,
                email: email
            }]);

            return Promise.reject(error);
        });
    }

    updateUser(sisLoginId, firstName, lastName, email) {
        Logger.info(`Updating existing Canvas accont`, {
            sisLoginId: sisLoginId,
            firstName: firstName,
            lastName: lastName,
            email: email
        });

        return this.client({
            method: `PUT`,
            uri: `/users/sis_login_id:${sisLoginId}`,
            form: {
                'user[name]': firstName + ' ' + lastName,
                'user[short_name]': firstName + ' ' + lastName,
                'user[sortable_name]': lastName + ', ' + firstName,
                'user[email]': (email) ? email : 'missingemail@fhda.edu'
            }
        })
        .catch(error => {
            Logger.error(`Failed to update existing Canvas account` [error, {
                sisLoginId: sisLoginId,
                firstName: firstName,
                lastName: lastName,
                email: email
            }]);

            return Promise.reject(error);
        });
    }

    /**
     * Courses
     */

    /**
     * Get a course object from Canvas by its unique ID
     * @param {String|Number} id Canvas course ID
     * @returns {Promise} Resolved with the requested object
     */
    getCourse(id) {
        return this.client
            .get(`/courses/${id}`)
            .promise();
    }

    /**
     * Create a new course in Canvas with parameters set by the provided
     * object map.
     * @param {Object} payload Object of key-value properties following the Instructure API documentation
     * @returns {Promise} Resolved with the newly created Canvas course object
     */
    createCourse(payload) {
        return this.client({
            method: `POST`,
            uri: `/accounts/1/courses`,
            form: payload
        })
        .promise()
        .tap(course => {
            Logger.verbose('Created new Canvas course', course);
        });
    }

    /**
     * Delete an existing course in Canvas by its unique ID.
     * @param {String|Number} id Canvas course ID
     * @returns {Promise} Resolved with the now deleted Canvas course object
     */
    deleteCourse(id) {
        return this.getCourse(id)
            .tap(course => {
                return this.client({
                    method: `DELETE`,
                    uri: `/courses/${course.id}`,
                    useQuerystring: true,
                    qs: {
                        'event': 'delete'
                    }
                });
            })
            .tap(course => {
                Logger.info('Deleted Canvas course', course);
            });
    }

    /**
     * Get a list of the Canvas courses that a user is associated with,
     * filtered by the SIS ID for a specific enrollment term.
     * @param {String} termCode Banner term code
     * @param {String} sisLoginId Banner login identity for the person
     * @param {Boolean} [withSections=false] If true, perform a secondary lookup and get the Canvas section objects for the course
     * @returns {Promise} Resolved with an array of Course objects
     *
     */
    getCoursesForUser(termCode, sisLoginId, withSections=false) {
        let parent = this;

        return Promise.all([
            this.getEnrollmentTermBySisId(termCode),
            this.client({
                method: 'GET',
                uri: `/users/sis_login_id:${sisLoginId}/courses`,
                useQuerystring: true,
                qs: {
                    'state[]': ['unpublished', 'available'],
                    'per_page': '250',
                }
            })])
        .spread((enrollmentTerm, courses) => {
            // Filter result courses by enrollment term ID
            return courses.filter(course => {
                return course.enrollment_term_id === enrollmentTerm.id;
            });
        })
        .map(course => {
            // Skip section transform if not requested
            if(!(withSections)) {
                return course;
            }

            // Add promise to be fufilled with info about course sections
            // Filter objects that do not have an SIS ID (these are typically the root course in the site)
            course.sections = parent.client
                .get(`/courses/${course.id}/sections`)
                .promise()
                .filter(section => section.sis_section_id !== null);

            // Transform course with pending promises
            return Promise.props(course);
        });
    }

    /**
     * Enrollment Terms
     */

    /**
     * Get all enrollment terms defined in a Canvas college account.
     * @returns {Promise} Resolved with an array of EnrollmentTerm objects
     *
     */
    getEnrollmentTerms() {
        return this.client
            .get(`/accounts/1/terms`)
            .then(response => { return response.enrollment_terms; });
    }

    /**
     * Get a specific Canvas enrollment term by its native ID.
     * @param {Number} id Enrollment term ID
     * @returns {Promise} Resolved with the matching EnrollmentTerm object, or an empty array if not found
     */
    getEnrollmentTerm(id) {
        return this
            .getEnrollmentTerms()
            .reduce((result, enrollmentTerm) => {
                if(enrollmentTerm.id === id) {
                    return enrollmentTerm;
                }
                return result;
            });
    }

    /**
     * Get a specific Canvas enrollment term by its SIS ID.
     * @param {String} sisId Banner term code
     * @returns {Promise} Resolved with the matching EnrollmentTerm object, or an empty array if not found
     */
    getEnrollmentTermBySisId(sisId) {
        return this
            .getEnrollmentTerms()
            .reduce((result, enrollmentTerm) => {
                if(enrollmentTerm.sis_term_id === sisId) {
                    return enrollmentTerm;
                }
                return result;
            });
    }

    /**
     * Get a list of enrollments for a specific user, for a specific Banner
     * SIS term, and optionally filtered by an enrollment status other than
     * 'active'.
     * @param {String} termCode Banner term code
     * @param {String} sisLoginId Banner login identity for the person
     * @param {String} [state=active] Enrollment state to filter to further narrow results
     */
    getEnrollmentsForUser(termCode, sisLoginId, state='active') {
        return this.client
            .get(`/users/sis_login_id:${sisLoginId}/enrollments`)
            .promise()
            .map(enrollment => {
                // Parse Banner SIS section ID to get the term and CRN
                let parsedSectionId = Common.parseSisSectionId(enrollment.sis_section_id);

                // Decorate enrollment
                enrollment.bannerTerm = parsedSectionId.term;
                enrollment.bannerCrn = parsedSectionId.crn;

                // Return object
                return enrollment;
            })

            // Filter by specific Banner term and enrollment state
            .filter(enrollment => enrollment.bannerTerm === termCode && enrollment.enrollment_state === state);
    }

    /**
     * Sections
     */

    /**
     * Get a Canvas section by its unique ID
     * @param {String|Number} id Canvas section ID
     * @returns {Promise} Resolved with the Section object if found
     */
    getSection(id) {
        return this.client
            .get(`/sections/${id}`)
            .catch(error => {
                if(error.statusCode === 404) {
                    Logger.verbose(`Could not find section ${id} in Canvas`);
                    return null;
                }
                return Promise.reject(error);
            });
    }

    /**
     * Create a new Canvas section in an existing course.
     * @param {String|Number} courseId ID for the Canvas course where the section will be created
     * @param {String} name Name of the section (will be visible to users)
     * @param {String} term Banner term (used in the SIS section ID)
     * @param {String} crn Banner section CRN (used in the SIS section ID)
     * @returns {Promise} Resolved with the newly created Section object
     */
    createSection(courseId, name, term, crn) {
        return this.client({
            method: `POST`,
            uri: `/courses/${courseId}/sections`,
            form: {
                'course_section[name]': name,
                'course_section[sis_section_id]': `${term}:${crn}:${Random.number(4)}`,
                'course_section[integration_id]': `${term}:${crn}`
            }
        })
        .promise()
        .tap(section => {
            // Audit log
            Logger.verbose(`Created new Canvas section`, [{term: term, crn: crn}, section]);
        });
    }

    /**
     * Delete an existing Canvas section. <em>Note: this function does not take
     * care of any enrolled students in the section. These must be deleted
     * from the section prior to calling this API.</em>
     * @param {String|Number} id Canvas section ID
     * @returns {Promise} Resolved with the now deleted Section object
     */
    deleteSection(id) {
        return this.client
            .del(`/sections/${id}`)
            .promise()
            .tap(section => {
                // Audit log
                Logger.verbose(`Deleted Canvas section`, section);
            });
    }

    /**
     * Enrollments
     */

    /**
     * Get an Enrollment object from Canvas.
     * @param {String|Number} id Canvas enrollment ID
     * @returns {Promise} Resolved with the Enrollment object if found
     */
    getEnrollment(id) {
        return this.client
            .get(`/accounts/1/enrollments/${id}`)
            .promise();
    }

    /**
     * Get all student Enrollment objects for an existing Canvas section.
     * @param {String|Number} id Canvas section ID
     * @param {String|Number} [perPage=250] Number of records to return in a single page
     * @returns {Promise} Resolved with an array of Enrollment objects
     */
    getSectionEnrollment(id, perPage=250) {
        return this.client({
            method: 'GET',
            uri: `/sections/${id}/enrollments`,
            useQuerystring: true,
            qs: {
                'per_page': `${perPage}`,
                'type[]': 'StudentEnrollment'
            }
        });
    }

    /**
     * Enroll an instructor into an existing Canvas course.
     * @param {String|Number} courseId Canvas course ID
     * @param {String|Number} userId Canvas user account ID
     * @returns {Promise} Resolved with the new instructor Enrollment object
     */
    enrollInstructor(courseId, userId) {
        return this.client({
            method: `POST`,
            uri: `/courses/${courseId}/enrollments`,
            form: {
                'enrollment[user_id]': userId,
                'enrollment[type]': 'TeacherEnrollment',
                'enrollment[enrollment_state]': 'active',
                'enrollment[notify]': 'false'
            }
        })
        .promise()
        .tap(enrollment => {
            Logger.verbose(`Enrolled instructor into Canvas course`, enrollment);
        });
    }

    /**
     * Enroll a student into an existing Canvas section.
     * @param {String|Number} sectionId Canvas section ID
     * @param {String|Number} userId Canvas user account ID
     * @returns {Promise} Resolved with the new student Enrollment object
     */
    enrollStudent(sectionId, userId) {
        return this.client({
            method: `POST`,
            uri: `/sections/${sectionId}/enrollments`,
            form: {
                'enrollment[user_id]': userId,
                'enrollment[type]': 'StudentEnrollment',
                'enrollment[enrollment_state]': 'active',
                'enrollment[notify]': 'false',
                'enrollment[limit_privileges_to_course_section]': 'true'
            }
        })
        .promise()
        .tap(enrollment => {
            Logger.verbose(`Enrolled student into Canvas course`, enrollment);
        });
    }

    /**
     * Drop a student from an existing Canvas section. Dropping a student means
     * inactivating their enrollment in Canvas. This leaves the door open for
     * a student to be re-enrolled in the class without losing any prior work.
     * @param {Object} enrollment The Enrollment in Canvas to inactivate
     * @returns {Promise} Resolved with now inactivated student Enrollment object
     */
    dropStudent(enrollment) {
        // Execute enrollment inactivate API call
        return this.client({
            method: 'DELETE',
            uri: `/courses/${enrollment.course_id}/enrollments/${enrollment.id}`,
            form: {
                'task': 'inactivate'
            }
        })
        .promise()
        .tap(enrollment => {
            Logger.verbose(`Dropped student from Canvas section`, enrollment);
        });
    }

    /**
     * Delete a student from an existing Canvas section. Deleting a student
     * means any of record of them in the section, including prior work, is
     * completely removed and cannot be restored.
     * @param {Object} enrollment The Enrollment in Canvas to delete
     * @returns {Promise} Resolved with now deleted student Enrollment object
     */
    deleteStudent(enrollment) {
        // Execute enrollment delete API call
        return this.client({
            method: 'DELETE',
            uri: `/courses/${enrollment.course_id}/enrollments/${enrollment.id}`,
            form: {
                'task': 'delete'
            }
        })
        .promise()
        .tap(enrollment => {
            Logger.verbose(`Dropped student from Canvas section`, enrollment);
        });
    }

    /**
     * Helper function to look up and delete all active student enrollments
     * from an existing Canvas section.
     * @param {String} id Canvas section object ID
     * @returns {Promise} Resolved with an array of the deleted student Enrollment objects
     */
    deleteSectionEnrollments(id) {
        let parent = this;

        // Step 1: List all student enrollments for the section
        return this.getSectionEnrollment(id)
            .promise()

            // Step 2: Remove each enrollment from the section
            .map(enrollment => {
                return parent.deleteStudent(enrollment);
            }, Common.concurrency.MULTI)

            .tap(enrollments => {
                // Validate that enrollment objects existed
                if(enrollments.length > 0) {
                    // Audit log
                    Logger.info(`Completed removal of all enrolled students from Canvas section`, {
                        count: enrollments.length,
                        sisCourseId: enrollments[0].sis_course_id,
                        sisSectionId: enrollments[0].sis_section_id
                    });
                }
            });
    }

}

module.exports = CanvasApiClient;
