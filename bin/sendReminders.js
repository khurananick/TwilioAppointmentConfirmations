/*
 * This script is used in conjunction with a Twilio Studio Flow
 * to trigger a series of reminders for an upcoming appointment.
 * We start with including some libraries and details we need.
 */
const env     = require('dotenv').config().parsed;
const request = require('request-promise');
const fs      = require('fs');
const glob    = require('glob');
const papa    = require("papaparse");

// converts your account sid and auth token into a base64 string to be sent as Basic auth.
const AUTH_BASE64         = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

// defines the caller id of the phone number the voice reminder call comes from.
const CALL_FROM_NUMBER    = env.CALL_FROM_NUMBER.split(',');

// an array of phone numbers to send SMS from in case the person has multiple appoinments
// in the same window of time when you're sending your reminders.
const SMS_FROM_NUMBER     = env.SMS_FROM_NUMBER.split(',');

// each time you run this script, it will first test if max sms is reached.
// until max sms is reached, the script will send a text message reminder
// once sms max is reached, it will start sending voice calls for max calls
// if you use the default here, the first two times you run this script it will
// send a text reminder. the third time will send a voice reminder. after that
// it will not send any more reminders.
const MAX_SMS             = 2
const MAX_CALL            = 1

// this function takes in the row information and channel
// then creates a message template to be used when communicating
// with the person. the function returns an object that the
// studio flow will rely on. 
function createMessageFromTemplate(row, channel) {
  const resp = { channel: channel, language: row.data.Language };

  function english() {
    resp.confirmation_message = `Thanks! See you at the office.`;
    resp.cancellation_message = `We understand that plans change. Thanks for letting us know!`;
    resp.invalid_response_message = `We're sorry, we couldn't understand your response.`;
    if(channel == "Voice")
      resp.initial_message = `Hi ${row.data.PatientName}, Your appointment is on ${row.data.DateAndTime}. Press 1 to confirm or 2 to cancel.`;
    else if(channel == "SMS")
      resp.initial_message = `Hi ${row.data.PatientName}, Your appointment is on ${row.data.DateAndTime}. Reply 1 to confirm or 2 to cancel.`;
    return resp;
  }
  function spanish() {
    resp.confirmation_message = `Spanish confirmation message.`;
    resp.cancellation_message = `Spanish cancel confirmation message.`;
    resp.invalid_response_message = `Spanish invalid response message.`;
    if(channel == "Voice")
      resp.initial_message = `Spanish initial voice message.`;
    else if(channel == "SMS")
      resp.initial_message = `Spanish initial sms message.`;
    return resp;
  }

  switch(row.data.Language) {
    case "es":
      return spanish();
    default:
      return english();
  }
}

// synchronously delays next line until
// time between starttime and endtime is passed
function sleep(startTime, endTime) {
  let lapse = endTime - startTime;
  if(lapse > 1000) return;
  let ms = 1000 - lapse;
  var start = new Date().getTime(), expire = start + ms;
  while (new Date().getTime() < expire) { }
  return;
}

// triggers the twilio studio flow
// with the required data to make a call or send a sms
async function triggerAppointmentReminder(message_params, to, from, from_number_index=0) {
  const errorHandle = async function(error) {
    const err = JSON.parse(error.error);
    if(err.code == 20409)
      return JSON.stringify(await triggerAppointmentReminder(message_params, to, from, ++from_number_index));
    else
      return JSON.stringify({error: err.code});
  };

  const options = {
    method: 'POST',
    url: env.STUDIO_FLOW_ENDPOINT,
    headers: {
      Authorization: `Basic ${AUTH_BASE64}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      To: to,
      From: from[from_number_index],
      Parameters: JSON.stringify(message_params)
    }
  };
  const response = await request(options).catch(errorHandle);
  return JSON.parse(response);
}

// adds headers needed for us to track
// how many sms and calls were sent to 
// the contact so we can decide next action
function setRowHeadersIfNotExist(row) {
  const headers = [
    ['SMS_SENT',0],
    ['CALLS_SENT',0],
    ['CURRENT_EXECUTION_SID','NONE'],
    ['CONFIRMED','NO'],
    ['CANCELED','NO'],
    ['ANSWERED','NO']
  ];
  for(const header of headers)
    if(!row.data[header[0]])
      row.data[header[0]] = header[1];
  return row;
}

async function makeVoiceCall(row) {
  console.log(`Sending Call ${Number(row.data.CALLS_SENT)+1} to ${row.data.AppointmentId}`);
  const message_params = createMessageFromTemplate(row, 'Voice');
  const execution = await triggerAppointmentReminder(message_params, row.data.PhoneNumber, CALL_FROM_NUMBER);
  if(execution.sid) {
    row.data.CALLS_SENT = Number(row.data.CALLS_SENT) + 1;
    row.data.CURRENT_EXECUTION_SID = `${execution.flow_sid}.${execution.sid}`;
  }
  return row;
}

async function sendSMS(row) {
  console.log(`Sending SMS ${Number(row.data.SMS_SENT)+1} to ${row.data.AppointmentId}`);
  const message_params = createMessageFromTemplate(row, 'SMS');
  const execution = await triggerAppointmentReminder(message_params, row.data.PhoneNumber, SMS_FROM_NUMBER);
  if(execution.sid) {
    row.data.SMS_SENT = Number(row.data.SMS_SENT) + 1;
    row.data.CURRENT_EXECUTION_SID = `${execution.flow_sid}.${execution.sid}`;
  }
  return row;
}

function processFile(filepath, callback) {
  const completedRows = [];

  // callback function when each new row is read
  const processRow = async function(row, parser) {
    parser.pause(); // don't go to next line until we've processed this line.

    const timeLapse = new Date().getTime(); // start time of this function.

    setRowHeadersIfNotExist(row);

    if(row.data.CONFIRMED=='YES' || row.data.CANCELED=='YES') {
      console.log('Response received.');
    }
    else if(row.data.SMS_SENT < MAX_SMS) {
      row = await sendSMS(row);
    }
    else if(row.data.CALLS_SENT < MAX_CALL) {
      row = await makeVoiceCall(row);
    }
    else {
      console.log('MAX_ALERTS_REACHED.', row.data.PhoneNumber);
    }

    sleep(timeLapse, new Date().getTime()); // sleep long enough to let 1 second pass by.

    completedRows.push(row.data);

    parser.resume();
  };

  // callback function when last row is read
  const finished = async function(row, parser) {
    // if file has completed processing,
    // send message to remaining batch of numbers.
    fs.writeFileSync(filepath, papa.unparse(completedRows));
    callback();
  };

  const file = fs.readFileSync(filepath, 'utf8');
  papa.parse(file, { // read from file and start processing messages.
    header: true,
    worker: true,
    step: processRow,
    complete: finished
  });
}

function init() {
  glob("lists/*.csv", {}, function(err, files) {
    function callback() {
      if(files.length) {
        const filepath = files.shift();
        console.log('Working on', filepath);
        processFile(filepath, callback);
      }
      else {
        console.log('Finished sending reminders!');
        process.exit(0);
      }
    }

    callback();
  });
}

init();