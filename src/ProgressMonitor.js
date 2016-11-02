'use strict';
let EventEmitter = require('events');

/**
 * ProgressMonitor instances can be created and passed across various steps
 * of one long running operation to track and report its progress back
 * to a requesting client (i.e creating a new Canvas course).
 * @license BSD-3-Clause
 */
class ProgressMonitor extends EventEmitter {

    /**
     * Create a new instance with all properties set to zero (i.e. no progress).
     */
    constructor() {
        super();

        // Set initial values
        this.percentCompleted = 0;
        this.tasksCompleted = 0;
        this.tasksTotal = 0;
    }

    /**
     * Add tasks to the total count expected to be completed
     * @param {Number} amount Number of tasks to add
     */
    addTasks(amount) {
        this.tasksTotal += amount;
    }

    /**
     * Mark the number (one or more) of tasks completed. Each update also
     * recalculates the internal percentage completed.
     * @param {Number} [completed=1] Number of tasks completed
     */
    completeTask(completed=1) {
        // Update the number of tasks completed
        this.tasksCompleted += completed;

        // Calculate the latest percent completed as an integer 0-100
        this.percentCompleted = Math.round((this.tasksCompleted / this.tasksTotal) * 100);

        // Fire an event to interested parties that the percent has changed
        this.emit('progressUpdated', {percent: this.percentCompleted});
    }

    /**
     * Get the percentage of tasks completed
     * @returns {Number}
     */
    getPercentComplete() {
        return this.percentCompleted;
    }

}

module.exports = ProgressMonitor;
