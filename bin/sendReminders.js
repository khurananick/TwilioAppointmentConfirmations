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
  console.log(`Sending Call ${Number(row.data.CALLS_SENT)+1} to ${row.data.AppointmentId} / ${row.data.PhoneNumber}`);
  const message_params = createMessageFromTemplate(row, 'Voice');
  const execution = await triggerAppointmentReminder(message_params, row.data.PhoneNumber, CALL_FROM_NUMBER);
  if(execution.sid) {
    row.data.CALLS_SENT = Number(row.data.CALLS_SENT) + 1;
    row.data.CURRENT_EXECUTION_SID = `${execution.flow_sid}.${execution.sid}`;
  }
  return row;
}

async function sendSMS(row) {
  console.log(`Sending SMS ${Number(row.data.SMS_SENT)+1} to ${row.data.AppointmentId} / ${row.data.PhoneNumber}`);
  const message_params = createMessageFromTemplate(row, 'SMS');
  const execution = await triggerAppointmentReminder(message_params, row.data.PhoneNumber, SMS_FROM_NUMBER);
  if(execution.sid) {
    row.data.SMS_SENT = Number(row.data.SMS_SENT) + 1;
    row.data.CURRENT_EXECUTION_SID = `${execution.flow_sid}.${execution.sid}`;
  }
  return row;
}

// iterates through the csv file by row
// checks if a SMS or Voice notification needs
// to be sent to the contact and does the needful
// then overwrites the file with updated data
module.exports = function processFile(filepath, callback) {
  const completedRows = [];

  // callback function when each new row is read
  const processRow = async function(row, parser) {
    parser.pause(); // don't go to next line until we've processed this line.

    const timeLapse = new Date().getTime(); // start time of this function.

    setRowHeadersIfNotExist(row);

    if(row.data.CONFIRMED=='YES' || row.data.CANCELED=='YES') {
      console.log(`Response received from ${row.data.AppointmentId} / ${row.data.PhoneNumber}`);
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
