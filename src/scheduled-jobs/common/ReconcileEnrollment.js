'use strict';

// Export scheduled function
module.exports = async function() {
	this.logger.info(`Starting enrollment reconciliation job`, { college: this.name });
	await this.reconcileEnrollment();
	this.logger.info(`Completed enrollment reconciliation job`, { college: this.name });
};