/**
 * Provides a variey of utility functions for configuring
 * and getting pooled connections to a configured Banner database.
 * @license BSD-3-Clause
 * @module
 */

'use strict';
let Config = require('config');
let Logger = require('fhda-pubsub-logging')('banner');
let Oracle = require('oracledb');

/**
 * Helper function to get a fresh connection to Banner from the connection
 * pool, but first ensures that the pool was created successfully.
 * @return {Promise} Resolved with a connection from the pool
 */
function getConnection() {
    return oraclePool.then(() => {
        return Oracle.getConnection('banner');
    })
    .catch(error => {
        Logger.error(`An error occurred while getting a connection to Banner from the pool`, error);
    });
}

/**
 * Helper function to execute a single SQL statement with optional parameters
 * and execution settings, and automatically coordinating getting and releasing
 * the underlying connection from the pool.
 * @param  {String} statement SQL statement to execute
 * @param  {Object} params Object of bind values
 * @param  {Object} [options={}] Options to change connection behavior for this statement
 * @return {Promise|String} Resolved when the statement is resolved successfully
 */
function sql(statement, params={}, options={}) {
    // The acquired connection
    let connection; 

    return getConnection()
        .then(connectionRef => { connection = connectionRef; })
        .then(() => connection.execute(statement, params, options))
        .finally(() => connection.close());
}

/**
 * Helper function for promises returned from Oracle execte(...) that directly
 * returns the first row object from the rows array. This function presumes that
 * a query was executed which only returned one row.
 * @param  {Object} result Result object from Oracle drive
 * @return {Object} The first row object from the rows property
 */
function unwrapObject(result) {
    return result.rows[0];
}

/**
 * Helper function for promises returned from Oracle execte(...) that directly
 * returns the rows property.
 * @param  {Object} result Result object from Oracle drive
 * @return {Array} The rows property from the result
 */
function unwrapRows(result) {
    return result.rows;
}

/**
 * Module initialization
 */

// Set driver-level defaults
Oracle.autoCommit = true;
Oracle.outFormat = Oracle.OBJECT;

// Create a connection pool to Banner
let oraclePool = Oracle.createPool(Config.oracle.banner)
    .then(() => {
        Logger.info(`Created Oracle connection pool to Banner`, {
            instance: Config.oracle.banner.connectString
        });
    })
    .catch(error => {
        Logger.error(`An error occurred while creating the Banner connection pool`, error);
    });

// Module exports
module.exports = {
    getConnection: getConnection,
    sql: sql,
    unwrapObject: unwrapObject,
    unwrapRows: unwrapRows
};
