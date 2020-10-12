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
The default designed flow is for a 3-day reminder flow: the first 2 reminders are SMS. the final reminder is a voice call. \
This best works if you set up a cron task as follows:
- `node bin/sendReminders.js` at, say, 9am every morning.
- `node bin/checkResponses.js` at, say, 8am every morning. (an hour before sending new reminders).
What does this do? A few things! Essentially what this will do is:
- On Day1 at 8am there are no responses, but the script will run and end without any updates.
- On Day1 at 9am the script will run and send out SMS reminder to all the contacts in the csvs.
- On Day2 at 8am the script will check if any of the reminders from yesterday  had a response and update confirm/canceled accordingly.
- On Day2 at 9am the script will send another SMS to the contacts who never responded to Day1 SMS.
- On Day3 at 8am the script will check if any of the reminders from yesterday  had a response and update confirm/canceled accordingly.
- On Day3 at 9am the script will make a voice call to the contacts who never responded to Day2 SMS.

