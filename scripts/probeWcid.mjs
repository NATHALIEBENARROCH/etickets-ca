import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { getEvents } from '../lib/soapClient.js';

function normalizeEvents(resultValue) {
  if (!resultValue || resultValue === '') return [];
  if (Array.isArray(resultValue)) return resultValue;
  if (Array.isArray(resultValue.Event)) return resultValue.Event;
  if (resultValue.Event) return [resultValue.Event];
  return [];
}

const cliWcids = process.argv
  .slice(2)
  .map((value) => Number.parseInt(value, 10))
  .filter((value) => Number.isInteger(value) && value > 0);

const candidates = cliWcids.length > 0 ? cliWcids : [23933, 23888, 1, 1000, 10000];

console.log('🔎 Probing WCIDs on GetEvents...');
console.log('Endpoint:', process.env.TN_API_BASE || process.env.TN_API_URL);
console.log('Candidates:', candidates.join(', '));
console.log('');

for (const websiteConfigID of candidates) {
  try {
    const response = await getEvents({ websiteConfigID, numberOfEvents: 5 });
    const events = normalizeEvents(response.parsed?.result);

    console.log(`WCID ${websiteConfigID} -> HTTP ${response.status}, events: ${events.length}`);

    if (events.length > 0) {
      const sample = events[0];
      console.log('  ✅ WORKING WCID FOUND');
      console.log(`  Sample: ${sample.Name || sample.EventName || 'Unnamed'} (${sample.ID || sample.EventID || 'n/a'})`);
    }
  } catch (error) {
    console.log(`WCID ${websiteConfigID} -> ERROR: ${error.message}`);
  }
}

console.log('');
console.log('Done. Use the WCID with events > 0 in your .env.local as TN_WCID.');
