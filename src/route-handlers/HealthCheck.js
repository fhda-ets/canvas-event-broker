'use strict';
let BannerDatabase = require('../BannerDatabase.js');
let Logger = require('fhda-pubsub-logging')('health-check');

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
module.exports = async function(request, response) {
    // Attempt a ping query
    try {
        await BannerDatabase.sql('select sysdate from dual');
        Logger.info('AWS health check passed');
        response.send({ status: 'ok' });
    }
    catch(error) {
        Logger.error('AWS health check failed', error);
        response
            .status(500)
            .send({ status: 'fail' });
    }
};