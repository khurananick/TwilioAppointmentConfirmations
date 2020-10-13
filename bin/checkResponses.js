// ends the execution so that we can pull context
// to test if the context has a response.
async function endExecution(flow_sid, execution_sid) {
  console.log('Ending execution: ', execution_sid);

  const errorHandle = function(err) {
    return JSON.stringify({error: err.code});
  };

  const options = {
    'method': 'POST',
    'headers': {
      'Authorization': `Basic ${AUTH_BASE64}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    form: {
      Status: 'ended'
    },
    'url': `https://studio.twilio.com/v1/Flows/${flow_sid}/Executions/${execution_sid}`
  };
  const response = JSON.parse(await request(options).catch(errorHandle));

  if(response.execution_sid)
    console.log('Ended execution: ', response.execution_sid);

  return response;
}

// pulls the execution context for the sent SMS or Voice call
async function getExecutionContext(flow_sid, execution_sid) {
  console.log('Getting execution context: ', execution_sid);

  const errorHandle = function(err) {
    return JSON.stringify({error: err.code});
  };

  const options = {
    'method': 'GET',
    'headers': {
      'Authorization': `Basic ${AUTH_BASE64}`
    },
    'url': `https://studio.twilio.com/v2/Flows/${flow_sid}/Executions/${execution_sid}/Context`
  };
  const response = JSON.parse(await request(options).catch(errorHandle));

  console.log('Got execution context: ', response.execution_sid);

  return response;
}

// checks the execution context to see if the person ever responded
// either by text or voice and said confirm or cancel for the appointment reminder
async function checkResponse(row) {
  if(!row.data.CURRENT_EXECUTION_SID) return row;

  const sids = row.data.CURRENT_EXECUTION_SID.split('.');
  await endExecution(sids[0], sids[1]);
  const resp = await getExecutionContext(sids[0], sids[1]);

  console.log('Checking execution for response: ', sids[1]);
  if(resp.context.flow.variables) {
    if(resp.context.flow.variables.CONFIRMED) {
      console.log('Found confirm response: ', sids[1]);
      row.data.CONFIRMED = 'YES';
      row.data.ANSWERED = 'YES';
    }
    else if(resp.context.flow.variables.CANCELED) {
      console.log('Found cancel response: ', sids[1]);
      row.data.CANCELED = 'YES';
      row.data.ANSWERED = 'YES';
    }
  }

  if(!row.data.ANSWERED)
    console.log('No response found.', sids[1]);

  return row;
}

// iterates through the csv file by row
// tracks execution context for each row
// overwrites the current file with updated data once
// all of the rows are processed.
module.exports = function processFile(filepath, callback) {
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
