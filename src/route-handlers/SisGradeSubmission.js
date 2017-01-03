'use strict';
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
        // Write a temp file to disk for inspection
        Filesystem.writeFileSync('grades-raw.json', JSON.stringify(grades));

        Logger.info('Grades batch process complete');
        response.send({complete: true});

        // Dispatch grade processing task, and retain the promise for test cases
        //webcontext['batchProcess'] = processGradeSubmissions(grades, sharedState);
    });

};

function processGradeSubmissions(grades) {

}