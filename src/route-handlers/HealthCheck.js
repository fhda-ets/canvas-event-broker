'use strict';
let BannerDatabase = require('../BannerDatabase.js');
let Logger = require('fhda-pubsub-logging')('health-check');

/**
 * Provide a simple route as a health check to ensure that database
 * connectivity is available. AWS can use this health check to decide
 * which container instances are available to accept requests.
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