const env     = require('dotenv').config().parsed;
const request = require('request-promise');
const fs      = require('fs');
const glob    = require('glob');
const papa    = require("papaparse");

const base64Auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');

async function getExecutionContext(flow_sid, execution_sid) {
  const errorHandle = function(err) {
    console.log('ERROR', err);
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

async function checkResponse(row) {
  if(!row.data.CURRENT_EXECUTION_SID) return row;

  const sids = row.data.CURRENT_EXECUTION_SID.split('.');
  const resp = await getExecutionContext(sids[0], sids[1]);

  if(resp.context.flow.variables) {
    if(resp.context.flow.variables.CONFIRMED)
      row.data.CONFIRMED = 'YES';
    else if(resp.context.flow.variables.CANCELED)
      row.data.CANCELED = 'YES';
  }

  return row;
}

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