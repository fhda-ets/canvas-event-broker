'use strict';
let BannerOperations = require('../../BannerOperations');
let Debug = require('debug')('job:sync-da-orientation');
let DebugError = require('debug')('job:sync-da-orientation:error');
//let Logger = require('fhda-pubsub-logging')('scheduled-job.da.syncorientation');
let Moment = require('moment');

// Export scheduled function
module.exports = async function() {
	try {
		Debug(`Starting De Anza orientation exam sync`);
		
		// Lookup final grades for the orientation course
		let enrollments = await this.canvasApi.getFinalCourseGrades(this.config.orientationCourseId);

		// Iterate each enrollment
		for(let enrollment of enrollments) {
			// Validate score - must be 5/7 or greater
			if(enrollment.grades.final_score < 70) {
				// Skip students who have a lower score
				continue;
			}
			
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
			
			Debug(`Processing orientation exam completion`, {
				campusId: bannerPerson.campusId,
				enrollment: enrollment
			});
		}

		Debug(`Completed De Anza orientation exam sync`);
	}
	catch(error) {
		DebugError('Encountered an error while processing DA orientiation exam results', error);
	}
	
};