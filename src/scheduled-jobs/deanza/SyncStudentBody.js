'use strict';
let BannerOperations = require('../../BannerOperations');

// Export scheduled function
module.exports = async function() {
	this.logger.info(`Firing job!`, { college: this.name });
};