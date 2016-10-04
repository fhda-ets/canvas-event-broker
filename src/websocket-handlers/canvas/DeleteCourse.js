'use strict';
let BannerOperations = require('../../BannerOperations.js');
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-delete-sections');

module.exports = function (data, respond) {
    // Lookup college configuration
    let college = CollegeManager[data.college];

    return college.canvasApi
        .deleteCourse(data.canvasCourseId)
        .tap(BannerOperations.untrackTeacherEnrollments)
        .tap(BannerOperations.untrackCourse)
        .then(() => {
            respond({status: 'done', finalContext: context});
        });
};
