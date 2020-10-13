**Please note this is not an official Twilio supported application.**\
**This application does not come with any warranties. You may use this application at your own risk.** 

## Intro
This application uses a node CLI script + Twilio Studio to send out and confirm appointment reminders.

## Installation
**Step 1:** Import `flow.json` into a new [Studio Flow](https://www.twilio.com/console/studio/flows) in your Twilio Account.
<p align="center"><img src="./screenshots/flow.png?raw=true" width="650px" /></p>

**Step 2:** Assign your [Phone Numbers](https://www.twilio.com/console/phone-numbers/incoming) to the Studio Flow.
<p align="center"><img src="./screenshots/numbers.png?raw=true" width="450px" /></p>

**Step 3:** Clone this repository and copy `env.sample` to `.env` and add your account details in.
- `STUDIO_FLOW_ENDPOINT` is the REST API URL of your Studio Flow
<p align="center"><img src="./screenshots/endpoint.png?raw=true" width="450px" /></p>

- `CALL_FROM_NUMBER` and `CALL_FROM_NUMBER` are to be a comma-separated string of phone numbers from your account to be used for either sending a SMS or making a call.

## How To Run
**Step 1:** Add the `csv` file of your contacts into the lists directory. There's a list.csv.sample in there for a starting point. \
**Step 2:** To check responses and send out the confirmation messages, the command is `node app.js` \

## Default Desigend Flow
By running `node app.js` the application does the following:
- Iterates through the `csv` files in the `lists` folder to check if any contact has a previous studio execution.
- If the contact has a previous execution, the application will end the execution (if still active)
- If the contact has a previous execution, the application will pull the context of the execution to check if there was a response received.
- If response is received, the application will update the record so no new confirmations are sent.
- The application will then iterate over the list again and send out a SMS or Voice confirmation if no previous response is entered.
