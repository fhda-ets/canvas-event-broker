/**
 * Copyright (c) 2016, Foothill-De Anza Community College District
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 * this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 * this list of conditions and the following disclaimer in the documentation and/or
 * other materials provided with the distribution.
 *
 * 3. Neither the name of the copyright holder nor the names of its contributors
 * may be used to endorse or promote products derived from this software without
 * specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED.
 * IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
 * INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
 * BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
 * LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE
 * OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF
 * ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';
let BannerOperations = require('../../BannerOperations.js');
let Case = require('case');
let CollegeManager = require('../../CollegeManager.js');
let Common = require('../../Common.js');
let Errors = require('../../Errors.js');
let Logger = require('fhda-pubsub-logging')('ws-action-create-course');
let Pipeline = require('pipep');
let ProgressMonitor = require('../../ProgressMonitor.js');
let Random = require('random-gen');
let WebsocketUtils = require('../../WebsocketUtils.js');

/**
 * Handle a websocket request to create a new Canvas course/site classroom.
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = function (data, respond) {

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Create an execution context
    let context = Object.assign(data, {
        canvasApi: college.canvasApi,
        canvasSections: {},
        college: college,
        enrollment: {},
        instructors: [],
        progress: new ProgressMonitor(),
        ws: this
    }, data);

    // Attach an event handler to reporting progress changed back to the UI
    context.progress.on('progressUpdated', function(data) {
        context.ws.emit('ui:progress:setPercent', data);
    });

    // Create pipeline for coordinating course creation tasks
    let pipeline = Pipeline(
        getEnrollmentTerm,
        validateSectionsDoNotExist,
        getBannerCourse,
        getBannerSections,
        generateSectionNumberString,
        generateCourseName,
        generateCourseCode,
        createCourseSite,
        createSections,
        enrollInstructors);

    // start execution
    return pipeline(context)
        .then(context => {
            Logger.info(`Completed creation of new Canvas course site`);
            context.ws.emit('ui:progress:hide');
            respond({status: 'done'});
            return context;
        })
        .catch(WebsocketUtils.handleError.bind(
            this,
            'A serious error occurred while attempting to create a new Canvas course',
            Logger,
            respond
        ));
};

function createCourseSite(context) {
    context.ws.emit('ui:progress:setText', {text: 'Creating course'});

    return context.canvasApi.createCourse({
        'course[name]': context.generatedCourseName,
        'course[course_code]': context.generatedCourseCode,
        'course[term_id]': context.enrollmentTerm.id,
        'course[sis_course_id]': `${context.parentTerm}:${context.sanitizedSubject}${context.sanitizedCourseNumber}:${Random.number(4)}`
    })
    .then(canvasCourse => {
        // Add new Canvas course to the context;
        context.canvasCourse = canvasCourse;

        // Return context for chaining
        return context;
    });
}

function createSections(context) {
    context.ws.emit('ui:progress:setText', {text: 'Creating sections, and enrolling students'});

    return Promise.map(context.sections, section => {
        return context.college.createSection(section.term, section.crn, context.canvasCourse.id, context.progress)
        .tap(enrolledStudents => {
            context.enrollment[section.crn] = enrolledStudents;
        });
    }, Common.concurrency.MULTI)
    .return(context);
}

function enrollInstructors(context) {
    return BannerOperations
        .getInstructors(context.parentTerm, context.parentCrn)
        .map(instructor => {
            // Add instructor to context
            context.instructors.push(instructor);

            // Sync Canvas account
            return context.canvasApi.syncUser(
                instructor.campusId,
                instructor.firstName,
                instructor.lastName,
                instructor.email)

            // Enroll instructor in course
            .then(profile => {
                return [profile, context.canvasApi.enrollInstructor(
                    context.canvasCourse.id,
                    profile.id)];
            })
            .spread((profile, enrollment) => {
                // Add tracked enrollment in Banner
                return BannerOperations.trackEnrollment(
                    context.college,
                    context.parentTerm,
                    context.parentCrn,
                    instructor.pidm,
                    profile.id,
                    'TeacherEnrollment',
                    enrollment.id,
                    context.canvasCourse.id);
            });
        }, Common.concurrency.MULTI)
        .return(context);
}

function generateCourseCode(context) {
    context.generatedCourseCode = `${context.sanitizedSubject} ${context.sanitizedCourseNumber} (${context.sectionString})`;

    // Return context for chaining
    return context;
}

function generateCourseName(context) {
    context.generatedCourseName = `${context.abbreviatedTermCode} ${Case.title(context.parentCourse.title)} Sections ${context.sectionString}`;

    // Return context for chaining
    return context;
}

function generateSectionNumberString(context) {
    // Convert array of sections into comma delimited string
    context.sectionString = context.sections.map(section =>{
        return section.sectionNumber;
    })
    .join(', ');

    // Return context for chaining
    return context;
}

function getBannerCourse(context) {
    return BannerOperations
        .getCourse(context.parentTerm, context.parentCrn)
        .tap(course => {
            // Add the Banner course to the context
            context.parentCourse = course;

            // Perform some post-processing
            context.abbreviatedTermCode = Common.abbreviateTermCode(context.parentTerm);
            context.sanitizedSubject = Common.sanitizeSubjectCode(course.subjectCode);
            context.sanitizedCourseNumber = Common.sanitizeCourseNumber(course.courseNumber);
        })
        .return(context);
}

function getBannerSections(context) {
    return Promise.map(context.sections, section => {
        // Map a requested section to a real Banner section record
        return BannerOperations.getCourseSection(section.term, section.crn);
    }, Common.concurrency.SINGLE)
    .then(sections => {
        // Add mapped Banner sections to the context
        context.sections = sections;

        // Return context for chaining
        return context;
    });
}

function getEnrollmentTerm(context) {
    context.ws.emit('ui:progress:show', {text: 'Getting data from Banner'});

    // Get enrollment term object from Canvas filtered by SIS ID
    return context.canvasApi
        .getEnrollmentTermBySisId(context.parentTerm)
        .tap(enrollmentTerm => {
            // Add Canvas enrollment term object to the context
            context.enrollmentTerm = enrollmentTerm;
            Logger.debug(`Looked up Canvas enrollment term by SIS ID ${context.parentTerm}`, enrollmentTerm);
        })
        .return(context);
}

function validateSectionsDoNotExist(context) {
    return Promise.each(context.sections, section => {
        return BannerOperations.isSectionTracked(section.term, section.crn)
            .catch(Errors.UntrackedSection, () => {
                // Safe to ignore
            });
    })
    .return(context);
}
