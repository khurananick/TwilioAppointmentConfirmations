/*
 * This script is used in conjunction with a Twilio Studio Flow
 * to trigger a series of reminders for an upcoming appointment.
 * We start with including some libraries and details we need.
 */
const glob = require('glob');
env        = require('dotenv').config().parsed;
request    = require('request-promise');
fs         = require('fs');
papa       = require('papaparse');

// converts your account sid and auth token into a base64 string to be sent as Basic auth.
AUTH_BASE64         = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

// defines the caller id of the phone number the voice reminder call comes from.
CALL_FROM_NUMBER    = env.CALL_FROM_NUMBER.split(',');

// an array of phone numbers to send SMS from in case the person has multiple appoinments
// in the same window of time when you're sending your reminders.
SMS_FROM_NUMBER     = env.SMS_FROM_NUMBER.split(',');

// each time you run this script, it will first test if max sms is reached.
// until max sms is reached, the script will send a text message reminder
// once sms max is reached, it will start sending voice calls for max calls
// if you use the default here, the first two times you run this script it will
// send a text reminder. the third time will send a voice reminder. after that
// it will not send any more reminders.
MAX_SMS             = 2;
MAX_CALL            = 1;

// loading reference to each 
const sendReminders = require('./bin/sendReminders.js');
const checkResponses = require('./bin/checkResponses.js');

// looks for csv files in the lists folder
// then processes each file
function run() {
  let files1, files2;

  // for each csv file with contacts
  // runs through the contact to check if an
  // execution exists, if so, ends the execution
  // and checks if the user had responded.
  // updates the csv with response if any.
  function doCheckResponses() {
    if(files1.length) {
      const filepath = files1.shift();
      console.log('Working on', filepath);
      checkResponses(filepath, doCheckResponses);
    }
    else {
      console.log('Finished checking responses!');
      doSendReminders();
    }
  }

  // for each csv file with contacts
  // runs through the contact to check if a
  // response exists, if no response so far
  // triggers a SMS or a Voice reminder to the
  // contact based on MAX_SMS and MAX_CALL params
  function doSendReminders() {
    if(files2.length) {
      const filepath = files2.shift();
      console.log('Working on', filepath);
      sendReminders(filepath, doSendReminders);
    }
    else {
      console.log('Finished sending reminders!');
      process.exit(0);
    }
  }

  // looks up all the csv files in the lists
  // folder and assigns them into arrays
  // so that the checkResponses and sendReminders
  // functions can iterate through them.
  glob("lists/*.csv", {}, function(err, files) {
    // kicks off the process
    files1 = [...files];
    files2 = [...files];
    doCheckResponses();
  });
}

function test() {
}

// check for --test flag in command to run as test or live.
for(let arg of process.argv)
  if(arg.match("--test"))
    return test();

run();

