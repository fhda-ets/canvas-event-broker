'use strict';
let Botkit = require('botkit');
let CollegeManager = require('./CollegeManager.js');
let Config = require('config');
let Logger = require('fhda-logging').getLogger('slackbot');

// Load additional modules
let HandlerEnrollStudent = require('./event-handlers/EnrollStudent.js');
let HandlerDropStudent = require('./event-handlers/DropStudent.js');

Logger.info('Creating Slack bot integration');

// Create the bot controller
let controller = new Botkit.slackbot({
    debug: false,
    log: false
});

// Startup the bot
controller.spawn({
    token: Config.slackbot.token
}).startRTM();

// Create the enroll-student command
controller.hears(['enroll-student (.*) (.*) (.*)'], 'direct_message,direct_mention,mention', (bot, message) => {
    // Convert parameters into event
    let event = {
        id: 0,
        term: message.match[1],
        crn: message.match[2],
        pidm: parseInt(message.match[3])
    };

    // Match College to event
    let college = CollegeManager.getForTerm(event.term);

    // Validate
    if(!(college)) {
        return bot.reply(
            message,
            `:warning: Sorry, I could not find a college configuration for the term \`${event.term}\``);
    }

    HandlerEnrollStudent(college, event)
        .then(() => {
            bot.reply(
                message,
                `:white_check_mark: Student enrollment successfully processed`);
        })
        .catch(error => {
            bot.reply(
                message,
                `:warning: Sorry, I could not enroll that student because of an error \`\`\`${error.stack}\`\`\``);
        });

});

// Create the drop-student command
controller.hears(['drop-student (.*) (.*) (.*)'], 'direct_message,direct_mention,mention', (bot, message) => {
    // Convert parameters into event
    let event = {
        id: 0,
        term: message.match[1],
        crn: message.match[2],
        pidm: parseInt(message.match[3])
    };

    // Match College to event
    let college = CollegeManager.getForTerm(event.term);

    // Validate
    if(!(college)) {
        return bot.reply(
            message,
            `:warning: Sorry, I could not find a college configuration for the term \`${event.term}\``);
    }

    HandlerDropStudent(college, event)
        .then(() => {
            bot.reply(
                message,
                `:white_check_mark: Student drop successfully processed`);
        })
        .catch(error => {
            bot.reply(
                message,
                `:warning: Sorry, I could not drop that student because of an error \`\`\`${error.stack}\`\`\``);
        });

});
