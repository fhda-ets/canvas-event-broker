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
let CollegeManager = require('../../CollegeManager.js');
let Common = require('../../Common.js');
let CourseNameHelper = require('../../CourseNameHelper');
let Logger = require('fhda-pubsub-logging')('ws-action-create-course');
let ProgressMonitor = require('../../ProgressMonitor.js');
let Random = require('random-gen');

/**
 * Handle a websocket request to create a new Canvas course/site classroom.
 * @param  {Object} data Event data payload
 * @param  {Function} respond Callback function to send a response back to the client
 * @return {Promise} Resolved when the operation is complete
 */
module.exports = async function (data, respond) {

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Create an execution context
    let context = Object.assign(data, {
        canvasApi: college.canvasApi,
        canvasSections: {},
        college: college,
        enrollment: {},
        instructors: [],
        migrateFrom: data.migrateFrom,
        progress: new ProgressMonitor(),
        ws: this
    }, data);

    // Attach an event handler to reporting progress changed back to the UI
    context.progress.on('progressUpdated', function(data) {
        context.ws.emit('ui:progress:setPercent', data);
    });

    try {
        // Execute a pipline of coordinating course creation tasks
        // (each function is passed the context for the operation where data and
        // objects are shared across the request)
        await getEnrollmentTerm(context);
        await validateSectionsDoNotExist(context);
        await getBannerCourse(context);
        await getBannerSections(context);
        await createCourseSite(context);
        await createSections(context);
        await enrollInstructors(context);
        await migrateCourseContent(context);

        // Tell websocket caller we are done
        respond({status: 'done'});

        // Return context for additional integration testing
        return context;
    }
    catch(error) {
        // Log the error
        Logger.error('A serious error occurred while attempting to create a new Canvas course', {
            error: error,
            parentTerm: context.parentTerm,
            parentCrn: context.parentCrn,
            sections: context.sections
        });

        // Tell websocket about the error
        respond({status: 'error', message: error.message});
    }
    finally {
        // Notify the UI that the creation is complete
        context.ws.emit('ui:progress:hide');
    }

};

async function createCourseSite(context) {
    context.ws.emit('ui:progress:setText', {text: 'Creating course'});

    // Generate course name and code
    let courseName = await CourseNameHelper.generateCourseName(
        context.parentTerm,
        context.parentCrn,
        context.sections,
        context.college.config.courseNameTemplate);

    let courseCode = await CourseNameHelper.generateCourseCode(
        context.parentTerm,
        context.parentCrn,
        context.sections);

    // Create course in Canvas
    context.canvasCourse = await context.canvasApi.createCourse({
        'course[name]': courseName,
        'course[course_code]': courseCode,
        'course[term_id]': context.enrollmentTerm.id,
        'course[sis_course_id]': `${context.parentTerm}:${context.sanitizedSubject}${context.sanitizedCourseNumber}:${Random.number(4)}`
    });
}

async function createSections(context) {
    context.ws.emit('ui:progress:setText', {text: 'Creating sections, and enrolling students'});

    // Create each section and enroll students
    await Promise.map(context.sections, async section => {
        let enrollments = await context.college.createSection(section.term, section.crn, context.canvasCourse.id, context.progress);

        // Add enrollments to context
        context.enrollment[section.crn] = enrollments;
    }, Common.concurrency.MULTI);
}

async function enrollInstructors(context) {
    // Get instructors for parent course
    let instructors = await BannerOperations.getInstructors(context.parentTerm, context.parentCrn);

    // Iterate each instructor to sync account and enroll in course
    for(let instructor of instructors) {
        // Add instructor to context
        context.instructors.push(instructor);

        // Sync Canvas account
        let profile = await context.canvasApi.syncUser(
            instructor.campusId,
            instructor.firstName,
            instructor.lastName,
            instructor.email);

        // Enroll in course
        let enrollment = await context.canvasApi.enrollInstructor(
            context.canvasCourse.id,
            profile.id);

        // Add tracked enrollment to Banner
        await BannerOperations.trackEnrollment(
            context.college,
            context.parentTerm,
            context.parentCrn,
            instructor.pidm,
            profile.id,
            'TeacherEnrollment',
            enrollment.id,
            context.canvasCourse.id);
    }
}

async function getBannerCourse(context) {
    // Lookup parent course in Banner
    context.parentCourse = await BannerOperations.getCourse(context.parentTerm, context.parentCrn);

    // Add data transformations to context
    context.sanitizedSubject = Common.sanitizeSubjectCode(context.parentCourse.subjectCode);
    context.sanitizedCourseNumber = Common.sanitizeCourseNumber(context.parentCourse.courseNumber);
}

async function getBannerSections(context) {
    // Map sections to Banner section records
    context.sections = await Promise.map(
        context.sections,
        section => BannerOperations.getCourseSection(section.term, section.crn));
}

async function getEnrollmentTerm(context) {
    context.ws.emit('ui:progress:show', {text: 'Getting data from Banner'});

    // Add enrollment term object to context from Canvas filtered by SIS ID
    context.enrollmentTerm = await context.canvasApi.getEnrollmentTermBySisId(context.parentTerm);
    Logger.debug(`Looked up Canvas enrollment term by SIS ID ${context.parentTerm}`, context.enrollmentTerm);
}

async function migrateCourseContent(context) {
    // Is a course content migration requested?
    if(context.migrateFrom) {
        Logger.info(`Course creation task includes a content migration request from course ${context.migrateFrom}`);

        // Create migration request
        await context.canvasApi.createMigration(context.migrateFrom, context.canvasCourse.id);
    }
}

async function validateSectionsDoNotExist(context) {
    // Check each section in the request
    for(let section of context.sections) {
        Logger.info(`Verifiying that course section ${section.term}:${section.crn} is not already provisioned in Canvas`);

        // Run database query to check section status
        let sectioninBanner = (await BannerOperations.isSectionTracked(section.term, section.crn, false)) !== null;

        // Check result
        if(sectioninBanner) {
            throw new Error(`Cannot create a Canvas course because section ${section.term}:${section.crn} is already provisioned`);
        }
    }
}
