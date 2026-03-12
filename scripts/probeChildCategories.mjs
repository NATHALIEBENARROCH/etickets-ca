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

for (const parentCategoryID of [1, 2, 3]) {
  const response = await getEvents({ parentCategoryID, numberOfEvents: 200 });
  const events = normalizeEvents(response.parsed?.result);

  const grouped = new Map();
  for (const event of events) {
    const childId = String(event.ChildCategoryID || 'unknown');
    if (!grouped.has(childId)) grouped.set(childId, { count: 0, sample: [] });
    const bucket = grouped.get(childId);
    bucket.count += 1;
    if (bucket.sample.length < 3 && event.Name) bucket.sample.push(event.Name);
  }

  const top = [...grouped.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([id, info]) => ({ id, count: info.count, sample: info.sample }));

  console.log(`\nParent ${parentCategoryID} (${events.length} events)`);
  console.log(JSON.stringify(top, null, 2));
}
