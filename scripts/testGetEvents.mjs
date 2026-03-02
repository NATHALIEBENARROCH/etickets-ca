import { callGetEvents } from '../lib/tokenManager.js';

(async () => {
  try {
    const xml = await callGetEvents({
      websiteConfigID: process.env.TN_WCID || '23933',
      numberOfEvents: 10,
      venueName: 'sepang'
    });
    console.log(xml);
  } catch (err) {
    console.error('Error calling GetEvents:', err.message);
    console.error(err);
    process.exit(1);
  }
})();
