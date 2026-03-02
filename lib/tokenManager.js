import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// Validar variables de entorno
function validateEnv() {
  const required = ['TN_CONSUMER_KEY', 'TN_CONSUMER_SECRET', 'TN_TOKEN_URL'];
  const missing = required.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// Cache en memoria (para Vercel serverless: validación on-demand, sin setTimeout)
let currentToken = null;
let expiresAt = 0; // timestamp ms

async function fetchTokenFromServer() {
  validateEnv();
  
  const key = process.env.TN_CONSUMER_KEY;
  const secret = process.env.TN_CONSUMER_SECRET;
  const tokenUrl = process.env.TN_TOKEN_URL;

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${auth}`
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });

    if (!response.ok) {
      throw new Error(`Token fetch failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access_token in response');
    }
    return data;
  } catch (error) {
    console.error('❌ Token fetch error:', error.message);
    throw error;
  }
}

export async function getToken(force = false) {
  // On-demand validation: si token válido y no expirado en 5s, reutilizar
  if (!force && currentToken && Date.now() < expiresAt - 5000) {
    return currentToken;
  }

  const data = await fetchTokenFromServer();
  currentToken = data.access_token;
  const expiresIn = data.expires_in || 3600; // seconds
  expiresAt = Date.now() + expiresIn * 1000;
  console.log('✅ Token obtained, expires_in:', expiresIn, 'seconds');
  return currentToken;
}

export function getCurrentToken() {
  if (currentToken && Date.now() < expiresAt) return currentToken;
  return null;
}

function escapeXml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildGetEventsSOAP(params = {}) {
  const {
    websiteConfigID = process.env.TN_WCID,
    numberOfEvents,
    venueName,
    eventDateFrom,
    eventDateTo,
    eventType,
    eventName,
    eventId
  } = params;

  if (!websiteConfigID) {
    throw new Error('websiteConfigID (WCID) is required for GetEvents');
  }

  const parts = [];
  parts.push(`<GetEvents xmlns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">`);
  parts.push(`<websiteConfigID>${escapeXml(websiteConfigID)}</websiteConfigID>`);
  if (numberOfEvents) parts.push(`<numberOfEvents>${escapeXml(numberOfEvents)}</numberOfEvents>`);
  if (venueName) parts.push(`<venueName>${escapeXml(venueName)}</venueName>`);
  if (eventDateFrom) parts.push(`<eventDateFrom>${escapeXml(eventDateFrom)}</eventDateFrom>`);
  if (eventDateTo) parts.push(`<eventDateTo>${escapeXml(eventDateTo)}</eventDateTo>`);
  if (eventType) parts.push(`<eventType>${escapeXml(eventType)}</eventType>`);
  if (eventName) parts.push(`<eventName>${escapeXml(eventName)}</eventName>`);
  if (eventId) parts.push(`<eventIds><long>${escapeXml(eventId)}</long></eventIds>`);
  parts.push(`</GetEvents>`);

  const body = parts.join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n` +
    `<soap:Body>\n${body}\n</soap:Body>\n</soap:Envelope>`;
}

export async function callGetEvents(params = {}) {
  // Determine API URL from env (support TN_API_URL or TN_API_BASE)
  const apiUrl = process.env.TN_API_URL || process.env.TN_API_BASE;
  if (!apiUrl) throw new Error('TN_API_URL or TN_API_BASE env var is required to call GetEvents');
  const soap = buildGetEventsSOAP(params);
  const token = await getToken();

  const headers = {
    'Accept': 'text/xml',
    'Content-Type': 'text/xml',
    'Authorization': `Bearer ${token}`,
    'SOAPAction': '"http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents"'
  };

  // Debug info (do not log full token in production)
  console.debug('Calling GetEvents ->', { apiUrl, headers: { ...headers, Authorization: 'Bearer [REDACTED]' } });

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: soap
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`GetEvents failed: ${response.status} ${response.statusText} - ${text}`);
  }

  return response.text();
}
