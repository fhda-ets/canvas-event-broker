'use strict';
let Config = require('config');
let Nodemailer = require('nodemailer');
let Nunjucks = require('nunjucks');

let nunjucksEnvironment = Nunjucks.configure('src/email-templates');

module.exports = {
    renderTemplate: function(templateName, data) {
        return nunjucksEnvironment.render(templateName, data);
    },
    
    transport: Nodemailer.createTransport(Config.email.transportUrl)
};
