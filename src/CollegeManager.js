'use strict';
let Config = require('config');
let College = require('./College.js');
let Logger = require('fhda-logging').getLogger('college-manager');

/**
 * Module initialization
 */

Logger.info('Loading college configurations');

// Define an object with a property for each loaded college
let colleges = {};

// Iterate each matching file
for(let collegeName in Config.colleges) {
    // Create new college objects
    let college = new College(collegeName);

    // Is the configured marked enabled?
    if(college.enabled) {
        colleges[college.name] = college;
        Logger.info(`Loaded college "${college.name}"`);
    }
    else {
        Logger.warn(`Skipped college "${college.name}" because it is marked disabled`);
    }
}

// Export loaded colleges
module.exports = colleges;

Logger.info('Finished loading college configurations');
