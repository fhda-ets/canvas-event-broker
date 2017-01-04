'use strict';
let BannerOperations = require('../BannerOperations.js');
let CollegeManager = require('../CollegeManager.js');
let FastCsv = require('fast-csv');
let Filesystem = require('fs');
let Logger = require('fhda-logging').getLogger('sis-grades');

module.exports = function(request, response) {

    // Lookup college object
    let college = CollegeManager[request.query.college];
    if(!(college)) {
        return response.send({
            error: true,
            message: 'Invalid college'
        });
    }

    // Define an array to capture grading records
    let grades = [];

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
        grades.push(data);
    });

    // Set up event listener to report errors
    csvParser.on('error', function(error) {
        Logger.error('Encountered an error during CSV parsing', error);
    });

    // Set up event listener for when parsing is complete
    csvParser.on('end', function() {
        // Dispatch grade processing task, and retain the promise for test cases
        processGradeSubmissions(college, grades);

        // Send success response
        Logger.info('Grades batch process complete');
        response.send({complete: true});
    });

};

function processGradeSubmissions(college, grades) {
    // Iterate each grade record
    Promise.each(grades, grade => {
        // Gather additional data before processing
        return Promise.props(Object.assign(grade, {
            bannerSection: BannerOperations.getTrackedSectionById(grade.section_sis_id),
            publisherProfile: college.canvasApi.getUser(grade.publisher_id, ''),
            studentProfile: college.canvasApi.getUser(grade.student_id, '')
        }));
    })
    .then(() => {
        // Write a temp file to disk for inspection
        Filesystem.writeFileSync('grades-raw.json', JSON.stringify(grades));
    });    
}