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

const testCases = [
  { label: 'default', opts: { websiteConfigID: 23933, numberOfEvents: 20 } },
  {
    label: 'wide-dates',
    opts: {
      websiteConfigID: 23933,
      numberOfEvents: 20,
      beginDate: '2000-01-01T00:00:00',
      endDate: '2099-12-31T23:59:59',
    },
  },
  {
    label: 'onlyMine-false',
    opts: {
      websiteConfigID: 23933,
      numberOfEvents: 20,
      onlyMine: false,
    },
  },
  {
    label: 'eventName-a',
    opts: {
      websiteConfigID: 23933,
      numberOfEvents: 20,
      eventName: 'a',
    },
  },
];

console.log('Probing filters for WCID 23933');

for (const testCase of testCases) {
  try {
    const response = await getEvents(testCase.opts);
    const events = normalizeEvents(response.parsed?.result);
    console.log(`${testCase.label} => status ${response.status}, events ${events.length}`);
  } catch (error) {
    console.log(`${testCase.label} => ERROR: ${error.message}`);
  }
}
