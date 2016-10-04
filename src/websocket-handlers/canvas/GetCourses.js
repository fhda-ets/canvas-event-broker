'use strict';
let CollegeManager = require('../../CollegeManager.js');

module.exports = function (data, respond) {
    return CollegeManager[data.college]
        .canvasApi
        .getCoursesForUser(data.term, this.decoded_token.aud)
        .tap(respond);
};
