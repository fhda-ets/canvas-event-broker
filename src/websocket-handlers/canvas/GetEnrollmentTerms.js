'use strict';
let CollegeManager = require('../../CollegeManager.js');

module.exports = function (data, respond) {
    return CollegeManager[data.college]
        .canvasApi
        .getEnrollmentTerms()
        .tap(respond);
};
