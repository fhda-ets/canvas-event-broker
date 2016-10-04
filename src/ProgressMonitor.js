'use strict';
let EventEmitter = require('events');

module.exports = class ProgressMonitor extends EventEmitter {

    constructor() {
        super();

        // Set initial values
        this.percentCompleted = 0;
        this.tasksCompleted = 0;
        this.tasksTotal = 0;
    }

    addTasks(amount) {
        this.tasksTotal += amount;
    }

    completeTask(completed=1) {
        // Update the number of tasks completed
        this.tasksCompleted += completed;

        // Calculate the latest percent completed as an integer 0-100
        this.percentCompleted = Math.round((this.tasksCompleted / this.tasksTotal) * 100);

        // Fire an event to interested parties that the percent has changed
        this.emit('progressUpdated', {percent: this.percentCompleted});
    }

    getPercentComplete() {
        return this.percentCompleted;
    }

};
