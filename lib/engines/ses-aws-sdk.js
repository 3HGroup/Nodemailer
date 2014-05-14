"use strict";

/*
 * SES using AWS SDK, rather than http POST - 3HGroup 05/2014
 *
 * This file is based on the original SES module for Nodemailer by dfellis
 * https://github.com/andris9/Nodemailer/blob/11fb3ef560b87e1c25e8bc15c2179df5647ea6f5/lib/engines/SES.js
 */

// NB! Amazon SES does not allow unicode filenames on attachments!
/*
var http = require('http'),
    https = require('https'),
    crypto = require('crypto'),
    urllib = require("url");
*/

var AWS = require('aws-sdk');
var ses = new AWS.SES();

// Expose to the world
module.exports = SESTransport;

/**
 * <p>Generates a Transport object for Amazon SES</p>
 *
 * <p>Possible options can be the following:</p>
 *
 * <ul>
 *     <li><b>AWSAccessKeyID</b> - AWS access key (required)</li>
 *     <li><b>AWSSecretKey</b> - AWS secret (required)</li>
 *     <li><b>ServiceUrl</b> - optional API endpoint URL (defaults to <code>"https://email.us-east-1.amazonaws.com"</code>)
 * </ul>
 *
 * @constructor
 * @param {Object} options Options object for the SES transport
 */
function SESTransport(options){
    this.options = options || {};

    //Set defaults if necessary
    this.options.ServiceUrl = this.options.ServiceUrl || "https://email.us-east-1.amazonaws.com";
}

/**
 * <p>Compiles a mailcomposer message and forwards it to handler that sends it.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run when the sending is completed
 */
SESTransport.prototype.sendMail = function(emailMessage, callback) {

    // SES strips this header line by itself
    emailMessage.options.keepBcc = true;

    /* NO, ALLOW IAM AUTH - Check if required config settings set
    if(!this.options.AWSAccessKeyID || !this.options.AWSSecretKey) {
        return callback(new Error("Missing AWS Credentials"));
    }*/

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
 * @param {String} email Compiled raw e-mail as a string
 * @param {Function} callback Callback function to run once the message has been sent
 */

SESTransport.prototype.handleMessage = function(options, email, callback) {
    var params = {
      RawMessage: { // required
        Data: new Buffer(email).toString('base64'), //'BASE64_ENCODED_STRING', // required
      },
      Destinations: [
        options.to, //'STRING_VALUE',
        // ... more items ...
      ],
      Source: options.from, //'STRING_VALUE',
    };

    ses.sendRawEmail(params, (function(err, data) {
        if (err){
            console.log('AWS SES ERROR');
            console.dir(err.stack);
            callback(err);
        } else {
            this.responseHandler(data,callback);
        }
    }).bind(this));
};

/**
 * <p>Compiles and sends the request to SES with e-mail data</p>
 *
 * @param {String} email Compiled raw e-mail as a string
 * @param {Function} callback Callback function to run once the message has been sent

SESTransport.prototype.handleMessage = function(email, callback) {
    var request,
        date = new Date(),
        urlparts = urllib.parse(this.options.ServiceUrl),
        pairs = {
            'Action': 'SendRawEmail',
            'RawMessage.Data': (new Buffer(email, "utf-8")).toString('base64'),
            'Version': '2010-12-01',
            'Timestamp': this.ISODateString(date)
        };

    if (this.options.AWSSecurityToken) {
        pairs.SecurityToken = this.options.AWSSecurityToken;
    }

    var params = this.buildKeyValPairs(pairs),

        reqObj = {
            host: urlparts.hostname,
            path: urlparts.path || "/",
            method: "POST",
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': params.length,
                'Date': date.toUTCString(),
                'X-Amzn-Authorization':
                    ['AWS3-HTTPS AWSAccessKeyID='+this.options.AWSAccessKeyID,
                    "Signature="+this.buildSignature(date.toUTCString(), this.options.AWSSecretKey),
                    "Algorithm=HmacSHA256"].join(",")
            }
        };

    //Execute the request on the correct protocol
    if(urlparts.protocol.substr() == "https:") {
        request = https.request(reqObj, this.responseHandler.bind(this, callback));
    } else {
        request = http.request(reqObj, this.responseHandler.bind(this, callback));
    }
    request.end(params);

    // Handle fatal errors
    request.on("error", this.errorHandler.bind(this, callback) );
};
*/


/**
 * <p>Handles a fatal error response for the HTTP request to SES</p>
 *
 * @param {Function} callback Callback function to run on end (binded)
 * @param {Object} response HTTP Response object
SESTransport.prototype.errorHandler = function(callback, err) {
    if( ! ( err instanceof Error) ) {
        err = new Error('Email failed ' + ("statusCode" in err ? err.statusCode : null ), {response:err});
    }
    return typeof callback == "function" && callback(err, null);
};
*/

/**
 * <p>Handles the response for the HTTP request to SES</p>
 *
 * @param {Function} callback Callback function to run on end (binded)
 * @param {Object} response HTTP Response object
 */

SESTransport.prototype.responseHandler = function(response, callback) {
    console.log('AWS SES response');
    console.dir(response);


};

/**
 * <p>Handles the response for the HTTP request to SES</p>
 *
 * @param {Function} callback Callback function to run on end (binded)
 * @param {Object} response HTTP Response object
SESTransport.prototype.responseHandler = function(callback, response) {
    var body = "", match;
    response.setEncoding('utf8');

    //Re-assembles response data
    response.on('data', function(d) {
        body += d.toString();
    });

    //Performs error handling and executes callback, if it exists
    response.on('end', function(err) {
        if(err instanceof Error) {
            return typeof callback == "function" && callback(err, null);
        }
        if(response.statusCode != 200) {
            return typeof callback == "function" &&
                callback(new Error('Email failed: ' + response.statusCode + '\n' + body), {
                    message: body,
                    response: response
                });
        }
        match = (body || "").toString().match(/<MessageId\b[^>]*>([^<]+)<\/MessageId\b[^>]*>/i);
        return typeof callback == "function" && callback(null, {
            message: body,
            response: response,
            messageId: match && match[1] && match[1] + "@email.amazonses.com"
        });
    });
};
*/

/**
 * <p>Compiles the messagecomposer object to a string.</p>
 *
 * <p>It really sucks but I don't know a good way to stream a POST request with
 * unknown legth, so the message needs to be fully composed as a string.</p>
 *
 * @param {Object} emailMessage MailComposer object
 * @param {Function} callback Callback function to run once the message has been compiled
 */

SESTransport.prototype.generateMessage = function(emailMessage, callback) {
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
