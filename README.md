**Please note this is not an official Twilio supported application.**\
**This application does not come with any warranties. You may use this application at your own risk.** 

## Intro
This application uses a node CLI script + Twilio Studio to send out and confirm appointment reminders.

## Installation
**Step 1:** Import `flow.json` into a new [Studio Flow](https://www.twilio.com/console/studio/flows) in your Twilio Account.
<p align="center"><img src="./screenshots/flow.png?raw=true" width="650px" /></p>

**Step 2:** Assign your [Phone Numbers](https://www.twilio.com/console/phone-numbers/incoming) to the Studio Flow.
<p align="center"><img src="./screenshots/numbers.png?raw=true" width="650px" /></p>

**Step 3:** Clone this repository and copy `env.sample` to `.env` and add your account details in.
- `STUDIO_FLOW_ENDPOINT` is the REST API URL of your Studio Flow
<p align="center"><img src="./screenshots/endpoint.png?raw=true" width="650px" /></p>
- `CALL_FROM_NUMBER` and `CALL_FROM_NUMBER` are to be a comma-separated string of phone numbers from your account to be used for either sending a SMS or making a call.

## How To Run
**Step 1:** Add the `csv` file of your contacts into the lists directory. There's a list.csv.sample in there for a starting point.
**Step 2:** To send out the messages, the command is `node bin/sendReminders.js`
**Step 3:** To check messages, the command is `node bin/checkResponses.js`

## Default Desigend Flow
The default expected flow here is that you have have a cron task that runs \
- `bin/sendReminders.js` at, say, 9am every morning.
- `bin/checkResponses.js` at, say, 8am every morning (an hour before sending new reminders).
What does this do? A few things! Essentially what this will do is:
- Every morning at 8am the script will check if there were any reminders sent the day before and, if so, then check if the person responded with a confirmation or cancelation response.
- At 9am, the script will look for all the contacts who have not responded so far and test what type of reminder to send next.

