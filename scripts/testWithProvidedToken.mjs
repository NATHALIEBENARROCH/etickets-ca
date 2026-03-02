import fs from 'fs';
import { fileURLToPath } from 'url';
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const token = fs.readFileSync(new URL('../.token.tmp', import.meta.url), 'utf8').trim();
const body = fs.readFileSync(new URL('../body.xml', import.meta.url), 'utf8');

const apiUrl = process.env.TN_API_URL || process.env.TN_API_BASE || 'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx';

(async () => {
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Accept: 'text/xml',
        'Content-Type': 'text/xml',
        SOAPAction: '"http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents"',
        Authorization: `Bearer ${token}`
      },
      body
    });

    const status = res.status;
    const text = await res.text();
    // redact token from any accidental echoes
    const redacted = text.replace(new RegExp(token, 'g'), '[REDACTED]');
    console.log('HTTP', status);
    console.log(redacted);
  } catch (err) {
    console.error('Request error:', err.message);
  }
})();
