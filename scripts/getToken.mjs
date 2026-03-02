import { getToken } from '../lib/tokenManager.js';

(async () => {
  try {
    const t = await getToken(true);
    console.log('TOKEN:', t);
  } catch (err) {
    console.error('Token error:', err.message);
  }
})();
