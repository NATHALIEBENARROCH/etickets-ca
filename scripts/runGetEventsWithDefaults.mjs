// Script: runGetEventsWithDefaults.mjs
// Purpose: set sensible defaults from provided values (only if not in env) and call GetEvents
// WARNING: This file contains defaults for convenience. Do NOT commit production secrets.

// Defaults (will only be applied if the env var is not already set)
const defaults = {
  TN_CONSUMER_KEY: '',
  TN_CONSUMER_SECRET: '',
  TN_WCID: '23933',
  TN_USERNAME: '',
  TN_PASSWORD: '',
  TN_TOKEN_URL: 'https://key-manager.tn-apis.com/oauth2/token',
  TN_API_BASE: 'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx'
};

for (const k of Object.keys(defaults)) {
  if (!process.env[k]) process.env[k] = defaults[k];
}

import { callGetEvents } from '../lib/tokenManager.js';

(async () => {
  try {
    const xml = await callGetEvents({
      websiteConfigID: process.env.TN_WCID,
      numberOfEvents: 10,
      venueName: 'sepang'
    });
    console.log(xml);
  } catch (err) {
    console.error('Error calling GetEvents:', err.message);
    // don't print full token or secrets
    if (err.stack) console.error(err.stack.split('\n').slice(0,5).join('\n'));
    process.exit(1);
  }
})();
