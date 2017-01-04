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
let BannerDatabase = require('../BannerDatabase.js');
let BannerOperations = require('../BannerOperations.js');
let CollegeManager = require('../CollegeManager.js');
let Config = require('config');
let EmailManager = require('../EmailManager.js');
let FastCsv = require('fast-csv');
let Filesystem = require('fs');
let Logger = require('fhda-logging').getLogger('sis-grades');
let MemoizePromise = require('promise-memoize');

const regexIsLetterGrade = /^[ABCDF][-+]?$/i;

const sqlGetExistingGrade = `
    select
        sfrstcr_grde_code as "grade"
    from
        sfrstcr
    where
        sfrstcr_term_code = :term
        and sfrstcr_crn = :crn
        and sfrstcr_pidm = gb_common.f_get_pidm(:campusId)
        and sfrstcr_grde_code is not null`;

const sqlPlsqlAssignGrade = `
    begin
        baninst1.sp_grading.p_post_grade(
            :term,
            gb_common.f_get_pidm(:studentCampusId),
            :crn,
            gb_common.f_get_pidm(:publisherCampusId),
            'F',
            :grade);
    end;`;

/**
 * Handle a Canvas grade submission payload. Canvas sends grades as a CSV
 * payloads to a designated public endpoint using POST request. It is the
 * responsibility of the implementator to provide endpoint security to prevent
 * tampering or unauthorized submissions.
 * @license BSD-3-Clause
 * @module
 * @param  {Object} request Express HTTP request
 * @param  {Object} response Express HTTP response
 */
module.exports = function(request, response) {

    // Lookup college object
    let college = CollegeManager[request.query.college];
    if(!(college)) {
        return response.send({
            error: true,
            message: 'Invalid college'
        });
    }

    // Validate per-college authentication key
    if(college.config.gradingApiKey !== request.query.auth) {
        return response.status(401).send({
            error: true,
            message: 'Invalid authentication key'
        });
    }

    // Create a context for the submission request
    let context = {
        bannerEnvironment: Config.oracle.banner.connectString.split('/')[1],
        college: request.query.college,
        datetime: new Date(),
        grades: []
    };

    // Write a temp file to disk for inspection
    Filesystem.writeFileSync('grades-raw.csv', request.body);
    
    // Attach CSV parser to incoming request body
    let csvParser = FastCsv.fromString(request.body, {
        headers: true,
        objectMode: true
    });

    // Set up event listener to capture each record
    csvParser.on('data', function(data) {
        Logger.debug('Received raw Canvas grading record', data);

        // Append grade object to buffer
        context.grades.push(data);
    });

    // Set up event listener to report errors
    csvParser.on('error', function(error) {
        Logger.error('Encountered an error during CSV parsing', error);
    });

    // Set up event listener for when parsing is complete
    csvParser.on('end', function() {
        // Dispatch grade processing task, and retain the promise for test cases
        processGradeSubmissions(college, context);

        // Send success response
        Logger.info('Grades batch process complete');
        response.send({complete: true});
    });

};

/**
 * Execute Banner PL/SQL API to assign a grade to a student.
 * @param {String} term Banner term code
 * @param {String} crn Banner section CRN
 * @param {String} studentCampusId Student campus ID (SPRIDEN_ID)
 * @param {String} publisherCampusId Publisher (Canvas instructor) campus ID (SPRIDEN_ID)
 * @param {String} grade Grade to assign
 * @returns {Promise} Resolved when the grade change is complete, or a String indicating an error message
 */
function assignGrade(term, crn, studentCampusId, publisherCampusId, grade) {
    // Validate grade is a letter character
    if(!(regexIsLetterGrade.test(grade))) {
        return Promise.resolve('non-letter-score');
    }

    return BannerDatabase.sql(sqlPlsqlAssignGrade, {
        term: term,
        crn: crn,
        studentCampusId: studentCampusId,
        publisherCampusId: publisherCampusId,
        grade: grade
    })
    .return(grade);
}

/**
 * Query Banner to see if the student has already received a grade. We will
 * not overrite existing grades because this requires the participation of A&R.
 * @param {String} term Banner term code
 * @param {String} crn Banner section CRN
 * @param {String} campusId Student campus ID (SPRIDEN_ID)
 * @returns {Promise} Resolved with the existing grade, or null if the student is not graded
 */
function hasExistingGrade(term, crn, campusId) {
    return BannerDatabase
        .sql(sqlGetExistingGrade, { 
            term: term,
            crn: crn,
            campusId: campusId })

        .then(result => {
            if(result.rows.length == 1) {
                return result.rows[0].grade;
            }
            return null;
        });
}

/**
 * Helper method to reduce code noise from using Promise.props and Object.assign
 * together.
 * @param {Object} target
 * @param {Object} source
 * @returns {Promise} Resolved when any promisified properties are also resolved
 */
function propsWithMerge(target, source) {
    return Promise.props(Object.assign(target, source));
}

/**
 * The main enchilada. Once the CSV is parsed and a submission context
 * created, the matching college along with the context should be passed
 * into this function to do all of the heavy lifting to process each
 * grade record into Banner.
 * @param {Object} college Matching college configuration
 * @param {Object} context Submission context
 */
function processGradeSubmissions(college, context) {

    // Memorize query operations (huge speed boost)
    let getCanvasUser = MemoizePromise((userId, type) => {
        return college.canvasApi.getUser(userId, type);
    }, { maxAge: 60000 });

    let getTrackedSection = MemoizePromise(BannerOperations.getTrackedSectionById, { maxAge: 60000 });

    // Define an async operation to resolve the course
    context.course = college.canvasApi.getCourse(context.grades[0].course_id);

    // Define an async operation to resolve the publisher
    context.publisher = college.canvasApi.getUser(context.grades[0].publisher_id, '');

    // Define an async operation to gather added information about each student
    // and submit each grade
    context.grades = Promise.map(context.grades, grade => {
        // Gather additional data before processing
        return Promise.props({
            bannerSection: getTrackedSection(Number(grade.section_id)),
            studentProfile: getCanvasUser(grade.student_id, '')
        })
        // Check if the student already has a grade letter assigned
        .then(result => propsWithMerge(result, {

            existingGrade: hasExistingGrade(
                result.bannerSection.term,
                result.bannerSection.crn,
                grade.student_sis_id)
        }))
        .then(result => Object.assign(grade, result))
        .catch(error => {
            Logger.error('Encountered an error while trying to resolve grade record', [error,  grade]);
        });
    }, {concurrency: 8});

    // Execute async operations
    Promise.props(context)
        // Get the enrollment term
        .then(result => propsWithMerge(result, {
            enrollmentTerm: college.canvasApi.getEnrollmentTerm(result.course.enrollment_term_id)
        }))
        .then(result => {
            // Iterate over each grade record
            return Promise.each(result.grades, grade => {
                // If a grade is already assigned, skip the record
                if(grade.existingGrade) {
                    grade.gradingOutcome = 'skipped-existing';
                    return;
                }
                
                // Assign the grade from Canvas
                return assignGrade(
                    grade.bannerSection.term,
                    grade.bannerSection.crn,
                    grade.student_sis_id,
                    result.publisher.sis_user_id,
                    grade.score)
                .then(result => grade.gradingOutcome = result);
            })
            .return(result);
        })
        .then(result => {
            // Send confirmation e-mail
            EmailManager.transport.sendMail({
                from: 'donotreply@fhda.edu',
                to: result.publisher.primary_email,
                subject: `Canvas Grades Confirmation - ${result.enrollmentTerm.name} - ${result.course.name}`,
                html: EmailManager.renderTemplate('GradeSubmissionConfirmation.html', result)
            })
            .then(mailerResult => {
                Logger.info(`Grade submission confirmation e-mail successfully sent`, {
                    smtp: mailerResult
                });
            });

            // Write a temp file to disk for inspection
            Filesystem.writeFileSync('grades-raw.json', JSON.stringify(result));

            Logger.info('Grade import completed');
        })
        .catch(error => {
            Logger.error('Encountered an error while trying processing grade import', error);
        });

}