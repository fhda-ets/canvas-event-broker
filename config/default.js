/**
 * Default configuration
 */
'use strict';
let OS = require('os');

module.exports = {

    apiserver: {
        enabled: true,
        listenPort: 8080
    },

    eventmanager: {
        enabled: true,
        interval: 15000
    },

    logging: {
        level: 'info',
        source: 'canvas-event-broker',
        environment: 'development',
        exitOnErrorEvent: false,
        exitOnUncaughtException: true,
        memoryReportingEnabled: false,
        transports: {
            console: true,
            file: true,
            splunk: false
        }
    },

    oracle: {
        banner: {
            poolAlias: 'banner',
            poolMin: 1,
            poolMax: OS.cpus().length,
            poolTimeout: 300,
        }
    }

};
