'use strict';
let BannerOperations = require('../../BannerOperations');
let Logger = require('fhda-pubsub-logging')('scheduled-job.da.syncorientation');
let Moment = require('moment');

// Export scheduled function
module.exports = async function() {
	Logger.info(`Starting De Anza orientation exam sync`);

	// Lookup final grades for the orientation course
	let enrollments = await this.canvasApi.getFinalCourseGrades(this.config.orientationCourseId);

	// Iterate each enrollment
	for(let enrollment of enrollments) {
		// Lookup user in Banner
		let bannerPerson = await BannerOperations.getPerson(enrollment.user.sis_login_id);

		// Clear existing DAOO orientation record from Banner
		await BannerOperations.deleteAdditionalId(bannerPerson.pidm, 'DAOO');

		// Insert new DAOO orientation record into Banner
		await BannerOperations.createAdditionalId(
			bannerPerson.pidm,
			'DAOO',
			`Y (${Moment().format('DD-MMM-YYYY')})`);

		// Mark enrollment in Canvas concluded
		await this.canvasApi.concludeStudent(enrollment);
		
		Logger.info(`Processing orientation exam completion`, {
			campusId: bannerPerson.campusId,
			enrollment: enrollment
		});
	}

	Logger.info(`Completed De Anza orientation exam sync`);
};