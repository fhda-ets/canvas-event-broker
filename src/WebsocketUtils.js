/**
 * Utility functions for use within websocket event handlers.
 * @license BSD-3-Clause
 * @module
 */

'use strict';

/**
 * Utility function to handle errors that bubble up from promises chains. Ensures
 * that the error is logged, that a predictable message format is returned to
 * the client, and that the Promise chain emits a rejection.
 * @param  {String} message String describing the error condition
 * @param  {Object} logger Logger object from calling module
 * @param  {Function} handlerCallback Completion callback for the websocket event handler
 * @param  {Object} error The error object that was bubbled up
 * @return {Promise} A rejected Promise with the original error
 */
function handleError(message, logger, handlerCallback, error) {
    logger.error(message, {
        error: error
    });

    handlerCallback({
        status: 'error',
        message: `${message}: ${(error.message) ? error.message : ''}`
    });

    return Promise.reject(error);
}

function handleAsyncError(message, logger, handlerCallback, error) {
    logger.error(message, {
        error: error
    });

    handlerCallback({
        status: 'error',
        message: `${message}: ${(error.message) ? error.message : ''}`
    });
}

// Module exports
module.exports = {
    handleError: handleError,
    handleAsyncError: handleAsyncError
};
