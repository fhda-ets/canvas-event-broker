'use strict';
let CollegeManager = require('../../CollegeManager.js');
let Logger = require('fhda-logging').getLogger('ws-action-delete-sections');
let ProgressMonitor = require('../../ProgressMonitor.js');

module.exports = function (data, respond) {
    // Create an alternate reference to the web socket
    let socket = this;

    // Lookup college configuration
    let college = CollegeManager[data.college];

    // Create a progress monitor
    let progress = new ProgressMonitor();

    // Attach an event handler to reporting progress changed back to the UI
    progress.on('progressUpdated', function(data) {
        socket.emit('ui:progress:setPercent', data);
    });

    socket.emit('ui:progress:show', {text: 'Deleting sections'});

    // Step 1: Iterate each section in request
    return Promise.each(data.sections, section => {
        socket.emit('ui:progress:setText', {text: `Deleting section with term ${section.term} and CRN ${section.crn}`});

        // Step 2: Delete the section including its enrollment
        return college.deleteSection(section.term, section.crn, progress);
    })
    .then(() => {
        socket.emit('ui:progress:hide');
        respond({status: 'done'});
    })
    .catch(error => {
        Logger.error(`A serious error occurred while handling a section delete websocket event`, [error, data]);
        respond({status: 'error', message: 'A serious error occurred while handling a section delete websocket event'});
        return Promise.reject(error);
    });
};
