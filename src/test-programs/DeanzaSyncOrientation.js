'use strict';

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load dependency modules
// let BannerOperations = require('../BannerOperations');
let College = require('../College');

// Create a college instance using the De Anza configuration
let college = new College('deanza');

// Load the orientation scheduled job
let job = require('../scheduled-jobs/deanza/SyncOrientationResults.js')
    .bind(college);

// Run the job
job();

// Attach a listener to identify SIGINT events and exit gracefully
process.on('SIGINT', () => process.exit(0));