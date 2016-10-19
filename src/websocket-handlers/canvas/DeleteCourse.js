'use strict';
let BannerOperations = require('../../BannerOperations.js');
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-delete-sections');

module.exports = function (data, respond) {
    // Create an alternate reference to the web socket
    let socket = this;

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Tell the client to display a progress bar
    socket.emit('ui:progress:show', {text: 'Deleting course'});

    return college.canvasApi
        .deleteCourse(data.canvasCourseId)
        .tap(BannerOperations.untrackTeacherEnrollments)
        .tap(BannerOperations.untrackCourse)
        .then(() => {
            socket.emit('ui:progress:hide');
            respond({status: 'done'});
        });
};
