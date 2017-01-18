'use strict';

// Replace ES6 Promises with Bluebird
global.Promise = require('bluebird');

// Load dependency modules
let BannerOperations = require('../BannerOperations');
let College = require('../College');

// Create a college instance using the De Anza configuration
let college = new College('deanza');

// Lookup a student
BannerOperations.getPerson({campusId: '20163968'})
    
    .then(person => {
        console.log('Queried person profile in Banner', person);

        // Test syncing the user enrollment for a particular account
        return college.syncStudent('201732', person);
    })

    .then(console.log);