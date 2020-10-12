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
const base64Auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

// pulls the execution context for the sent SMS or Voice call
async function getExecutionContext(flow_sid, execution_sid) {
  const errorHandle = function(err) {
    return JSON.stringify({error: err.code});
  };

  const options = {
    'method': 'GET',
    'headers': {
      'Authorization': `Basic ${base64Auth}`
    },
    'url': `https://studio.twilio.com/v2/Flows/${flow_sid}/Executions/${execution_sid}/Context`
  };
  const response = await request(options).catch(errorHandle);
  return JSON.parse(response);
}

// checks the execution context to see if the person ever responded
// either by text or voice and said confirm or cancel for the appointment reminder
async function checkResponse(row) {
  if(!row.data.CURRENT_EXECUTION_SID) return row;

  const sids = row.data.CURRENT_EXECUTION_SID.split('.');
  const resp = await getExecutionContext(sids[0], sids[1]);

  if(resp.context.flow.variables) {
    if(resp.context.flow.variables.CONFIRMED) {
      row.data.CONFIRMED = 'YES';
      row.data.ANSWERED = 'YES';
    }
    else if(resp.context.flow.variables.CANCELED) {
      row.data.CANCELED = 'YES';
      row.data.ANSWERED = 'YES';
    }
  }

  return row;
}


// iterates through the csv file by row
// tracks execution context for each row
// overwrites the current file with updated data once
// all of the rows are processed.
function processFile(filepath, callback) {
  const completedRows = [];
  // callback function when each new row is read
  const processRow = async function(row, parser) {
    parser.pause(); // don't go to next line until we've processed this line.

    row = await checkResponse(row);
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

// looks for csv files in the lists folder
// then processes each file
function run() {
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

function test() {
}

// check for --test flag in command to run as test or live.
for(let arg of process.argv)
  if(arg.match("--test"))
    return test();

run();
