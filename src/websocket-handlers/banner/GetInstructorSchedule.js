'use strict';
let BannerOperations = require('../../BannerOperations.js');

module.exports = function (data, respond) {
    BannerOperations
        .getInstructorSchedule(data.termCode, this.decoded_token.aud)
        .then(respond);
};
