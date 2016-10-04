'use strict';
let BannerOperations = require('../BannerOperations.js');
let DatasetBuilder = require('./DatasetBuilder.js');
//let Should = require('should');

describe(`Banner operations`,  function() {

    // Configure Mocha
    this.timeout(60000);

    it('Get instructor schedules (randomized)', function() {
        return DatasetBuilder
            .getRandomInstructors()
            .each(instructor => {
                return BannerOperations
                    .getInstructorSchedule(instructor.termCode, instructor.instructorId);
            });
    });

    it('Get Banner person profiles using numeric PIDM (randomized)', function() {
        return DatasetBuilder
            .getRandomInstructors()
            .each(instructor => {
                return BannerOperations.getPerson(instructor.pidm);
            });
    });

    it('Get Banner person profiles using PIDM property (randomized)', function() {
        return DatasetBuilder
            .getRandomInstructors()
            .each(instructor => {
                return BannerOperations.getPerson({pidm: instructor.pidm});
            });
    });

    it('Get Banner person profiles using campus ID property (randomized)', function() {
        return DatasetBuilder
            .getRandomInstructors()
            .each(instructor => {
                return BannerOperations.getPerson({campusId: instructor.instructorId});
            });
    });

});
