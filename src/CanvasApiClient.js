'use strict';
let Common = require('./Common.js');
let Logger = require('fhda-logging').getLogger('canvas-api-client');
let Random = require('random-gen');
let Request = require('request-promise');

module.exports = class CanvasApiClient {

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

    getUser(sisLoginId) {
        return this.client
            .get(`/users/sis_login_id:${sisLoginId}/profile`)
            .promise()
            .catch(error => {
                if(error.statusCode === 404) {
                    Logger.verbose(`Could not find user profile in Canvas`, {sisLoginId: sisLoginId});
                    return null;
                }
                return Promise.reject(error);
            });
    }

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
                else if(profile.name !== `${firstName} ${lastName}`) {
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
                'user[sortable_name]': `${firstName} ${lastName}`,
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
            Logger.error(`Failed to create new Canvas account`, error);
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
            Logger.error(`Failed to update existing Canvas account`, error);
        });
    }

    /**
     * Courses
     */

    getCourse(courseId) {
        return this.client
            .get(`/courses/${courseId}`)
            .promise();
    }

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

    deleteCourse(courseId) {
        return this.getCourse(courseId)
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

    getCoursesForUser(termCode, campusId) {
        return Promise.all([
            this.getEnrollmentTermBySisId(termCode),
            this.client({
                method: 'GET',
                uri: `/users/sis_login_id:${campusId}/courses`,
                useQuerystring: true,
                qs: {
                    'include[]': ['sections'],
                    'state[]': ['unpublished', 'available'],
                    'per_page': '250',
                }
            })])
        .spread((enrollmentTerm, courses) => {
            // Filter result courses by enrollment term ID
            return courses.filter(course => {
                return course.enrollment_term_id === enrollmentTerm.id;
            });
        });
    }

    /**
     * Enrollment Terms
     */

    getEnrollmentTerms() {
        return this.client
            .get(`/accounts/1/terms`)
            .then(response => { return response.enrollment_terms; });
    }

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
     * Sections
     */

    getSection(sectionId) {
        return this.client
            .get(`/sections/${sectionId}`)
            .catch(error => {
                if(error.statusCode === 404) {
                    Logger.verbose(`Could not find section ${sectionId} in Canvas`);
                    return null;
                }
                return Promise.reject(error);
            });
    }

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

    deleteSection(sectionId) {
        return this.client
            .del(`/sections/${sectionId}`)
            .promise()
            .tap(section => {
                // Audit log
                Logger.verbose(`Deleted Canvas section`, section);
            });
    }

    /**
     * Enrollments
     */

    getEnrollment(enrollmentId) {
        return this.client
            .get(`/accounts/1/enrollments/${enrollmentId}`)
            .promise();
    }

    getSectionEnrollment(sectionId) {
        return this.client({
            method: 'GET',
            uri: `/sections/${sectionId}/enrollments`,
            useQuerystring: true,
            qs: {
                'per_page': '250',
                'type[]': 'StudentEnrollment'
            }
        });
    }

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

    enrollStudent(sectionId, userId) {
        return this.client({
            method: `POST`,
            uri: `/sections/${sectionId}/enrollments`,
            form: {
                'enrollment[user_id]': userId,
                'enrollment[type]': 'StudentEnrollment',
                'enrollment[enrollment_state]': 'active',
                'enrollment[notify]': 'false'
            }
        })
        .promise()
        .tap(enrollment => {
            Logger.verbose(`Enrolled student into Canvas course`, enrollment);
        });
    }

    dropStudent(enrollment) {
        // Execute enrollment inactivate API call
        return this.client
            .del(`/courses/${enrollment.course_id}/enrollments/${enrollment.id}?task=inactivate`)
            .promise()
            .tap(enrollment => {
                Logger.verbose(`Dropped student from Canvas section`, enrollment);
            });
    }

    deleteStudent(enrollment) {
        // Execute enrollment delete API call
        return this.client
            .del(`/courses/${enrollment.course_id}/enrollments/${enrollment.id}?task=delete`)
            .promise()
            .tap(enrollment => {
                Logger.verbose(`Deleted student from Canvas section`, enrollment);
            });
    }

    /**
     * Perform a complete removal of all student enrollments in a Canvas course section.
     * Typically this is a precursor to deleting the section from an existing
     * Canvas course.
     * @param {String} sectionId Canvas section object ID
     */
    deleteSectionEnrollments(sectionId) {
        let parent = this;

        // Step 1: List all student enrollments for the section
        return this.getSectionEnrollment(sectionId)
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

};
