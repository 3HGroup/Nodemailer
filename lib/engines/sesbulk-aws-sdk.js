"use strict";

/*
 * 3HGroup 11/2014 - SDKSESBULK - copy of SDKSES transport
 *
 * SES using AWS SDK, rather than http POST
 *
 * This file is based on the original SES module for Nodemailer by dfellis
 * https://github.com/andris9/Nodemailer/blob/11fb3ef560b87e1c25e8bc15c2179df5647ea6f5/lib/engines/SES.js
 */

// NB! Amazon SES does not allow unicode filenames on attachments!
var AWS = require('aws-sdk');
var ses = null; //transport constructor will init this

// Expose to the world
module.exports = SDKSESBULKTransport;

/**
 * <p>Generates a Transport object for Amazon SES using AWS SDK</p>
 *
 * <p>Possible options can be the following:</p>
 *
 * <ul>
 *     <li><b>awssettings</b> - passed from the calling app
 * </ul>
 *
 * @constructor
 * @param {Object} options Options object for the SES transport
 */
function SDKSESBULKTransport(options){
    this.options = options || {};

    //Set defaults if necessary
    this.options.ServiceUrl = this.options.ServiceUrl || "https://email.us-east-1.amazonaws.com";

    //set up AWS SDK with settings for SES passed into options
    //11/14 - no longer using global settings update, breaks S3 image upload
    //if (options.awssettings) AWS.config.update(options.awssettings);
    if (options.awssettings) {
        ses = new AWS.SES(options.awssettings);
    } else {
        ses = new AWS.SES();
    }

}

/**
 * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run when the sending is completed
 */
SDKSESBULKTransport.prototype.sendMail = function(emailMessage, callback) {

    // SES strips this header line by itself
    emailMessage.options.keepBcc = true;

    this.generateMessage(emailMessage, (function(err, parsedemail){
        if(err){
            return typeof callback == "function" && callback(err);
        }
        this.handleMessage(emailMessage, parsedemail, callback);
    }).bind(this));
};

/**
 * <p>Compiles and sends the request to SES with e-mail data</p>
 *
 * @param {Object} msgObject - original message transport object, containing options
 * @param {String} email Compiled raw e-mail as a string for RawMessage in SES
 * @param {Function} callback Callback function to run once the message has been sent
 */

SDKSESBULKTransport.prototype.handleMessage = function(msgObject, email, callback) {
    //TESTING console.dir(msgObject);

    var params = {
      RawMessage: {
        Data: new Buffer(email).toString(), //'BASE64_ENCODED_STRING', // required
      },
      Destinations:
        msgObject._envelope.to, //array of destinations from msg object
        //[//'STRING_VALUE', ...],
      Source: msgObject._envelope.from[0], //'STRING_VALUE',
    };

    ses.sendRawEmail(params, (function(err, data) {
        if (err){
            /* TESTING
            console.log('AWS SES ERROR');
            console.dir(err.stack);
            */
            callback(err); //refer any error to the caller
        } else {
            this.responseHandler(data,callback);
        }
    }).bind(this));
};

/**
 * <p>Handles the response for the HTTP request to SES</p>
 *
 * @param {Function} callback Callback function to run on end (binded)
 * @param {Object} response HTTP Response object
 */

SDKSESBULKTransport.prototype.responseHandler = function(response, callback) {
    //note that most of the error handling happens on the send
    if (!response) callback(new Error('Email failed - SES response missing, but no error returned'));
    if (response && !response.MessageId) callback(new Error('Email failed - SES did not return MessageId'));
    return callback(null); //TODO: we may want to return this - response.MessageId;
};

/**
 * <p>Compiles the messagecomposer object to a string.</p>
 *
 * <p>It really sucks but I don't know a good way to stream a POST request with
 * unknown legth, so the message needs to be fully composed as a string.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run once the message has been compiled
 */

SDKSESBULKTransport.prototype.generateMessage = function(emailMessage, callback) {
    var email = "";

    emailMessage.on("data", function(chunk){
        email += (chunk || "").toString("utf-8");
    });

    emailMessage.on("end", function(chunk){
        email += (chunk || "").toString("utf-8");
        callback(null, email);
    });

    emailMessage.streamMessage();
};
