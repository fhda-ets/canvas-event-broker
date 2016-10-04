/**
 * Import modules
 */
"use strict";
var lint = require('mocha-eslint');

lint(['src/**/*.js', 'src/tests/*.js'], {
    timeout: 30000
});
