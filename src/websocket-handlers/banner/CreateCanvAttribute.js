'use strict';
let BannerOperations = require('../../BannerOperations.js');
let Common = require('../../Common.js');
let Logger = require('fhda-logging').getLogger('ws-action-create-canv-attr');
let WebsocketUtils = require('../../WebsocketUtils.js');

module.exports = function (data, respond) {
    // Validate the calling user is an admin
    if(!(this.decoded_token.canvasAdmin)) {
        respond({status: 'error', message: 'You are not an authorized site manager administrator'});
        return;
    }

    // Iterate faculty identities
    return Promise.map(data.campusIds, campusId => {
        // Transform faculty identities into Banner persons
        return BannerOperations.getPerson({campusId: campusId})
            .tap(person => {
                // Create CANV faculty attribute for person
                return BannerOperations.createCanvasFacultyAttribute(person.pidm);
            })
            .then(person => {
                return person.campusId;
            });
    }, Common.concurrency.SINGLE)
    .then(persons => {
        Logger.verbose(`Responding to WS create Canvas attribute action`);
        console.log(persons);

        // Send final response with list of CWIDs that were processed
        respond(persons);
    })
    .catch(WebsocketUtils.handleError.bind(
        this,
        'A serious error occurred while attempting update the CANV attribute for the requested instructors',
        Logger,
        respond
    ));
};
