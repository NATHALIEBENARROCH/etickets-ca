import { getToken } from './tokenManager.js';
import { getEnv } from './env.js';
import { parseSoapResponse } from './soapParser.js';

/**
 * Cliente SOAP para TicketNetwork v4.0
 * Los endpoints usan XML/SOAP, no JSON
 */

const SOAP_ENDPOINT =
  getEnv('TN_API_URL', 'TICKETNETWORK_API_URL') ||
  getEnv('TN_API_BASE', 'TICKETNETWORK_API_BASE') ||
  'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx';
const WCID = parseInt(getEnv('TN_WCID', 'WCID') || '23933', 10);
const SOAP_TIMEOUT_MS = parseInt(process.env.TN_SOAP_TIMEOUT_MS || '12000', 10);

async function fetchWithTimeout(url, options, timeoutMs = SOAP_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildSoapEnvelope(method, params) {
  const paramXml = Object.entries(params)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `<${key}>${escapeXml(String(value))}</${key}>`)
    .join('');

  const username = getEnv('TN_USERNAME', 'TICKETNETWORK_USERNAME');
  const password = getEnv('TN_PASSWORD', 'TICKETNETWORK_PASSWORD');
  const authHeader =
    username && password
      ? `<soap:Header>
    <tns:ServiceAuthHeader>
      <tns:Username>${escapeXml(username)}</tns:Username>
      <tns:Password>${escapeXml(password)}</tns:Password>
    </tns:ServiceAuthHeader>
  </soap:Header>`
      : '';

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">
  ${authHeader}
  <soap:Body>
    <${method} xmlns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">
      ${paramXml}
    </${method}>
  </soap:Body>
</soap:Envelope>`;
}

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function getEvents(options = {}) {
  const params = {
    websiteConfigID: options.websiteConfigID ?? WCID,
    numberOfEvents: options.numberOfEvents ?? 50,
    eventID: options.eventID,
    eventName: options.eventName,
    eventDate: options.eventDate,
    beginDate: options.beginDate ?? '2000-01-01T00:00:00',
    endDate: options.endDate ?? '2099-12-31T23:59:59',
    venueID: options.venueID,
    venueName: options.venueName,
    stateProvDesc: options.stateProvDesc,
    stateID: options.stateID,
    cityZip: options.cityZip,
    nearZip: options.nearZip,
    parentCategoryID: options.parentCategoryID,
    childCategoryID: options.childCategoryID,
    grandchildCategoryID: options.grandchildCategoryID,
    performerID: options.performerID,
    performerName: options.performerName,
    noPerformers: options.noPerformers,
    lowPrice: options.lowPrice,
    highPrice: options.highPrice,
    modificationDate: options.modificationDate,
    onlyMine: options.onlyMine,
    whereClause: options.whereClause,
    orderByClause: options.orderByClause,
  };

  const soap = buildSoapEnvelope('GetEvents', params);

  async function requestWithTokenRetry(retryOn401 = true) {
    const token = await getToken(!retryOn401);
    const response = await fetchWithTimeout(SOAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'text/xml',
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents"',
        'Authorization': `Bearer ${token}`,
      },
      body: soap,
    });

    if (response.status === 401 && retryOn401) {
      await getToken(true);
      return requestWithTokenRetry(false);
    }

    return response;
  }

  try {
    const response = await requestWithTokenRetry(true);

    const text = await response.text();

    if (text.trimStart().startsWith('<!DOCTYPE html') || text.trimStart().startsWith('<html')) {
      throw new Error('SOAP endpoint returned HTML. Verify TN_API_BASE/TN_API_URL points to TNWebservice.asmx and credentials are valid.');
    }
    
    if (!response.ok) {
      console.error('SOAP Error:', text.substring(0, 500));
      throw new Error(`SOAP request failed: ${response.status}`);
    }

    let parsed = null;
    let parseError = null;
    try {
      parsed = parseSoapResponse(text, 'GetEvents');
    } catch (error) {
      parseError = error.message;
    }

    return {
      status: response.status,
      xml: text,
      parsed,
      parseError,
    };
  } catch (error) {
    console.error('❌ SOAP GetEvents error:', error.message);
    throw error;
  }
}

export async function getTickets(eventId, options = {}) {
  const params = {
    websiteConfigID: options.websiteConfigID ?? WCID,
    numberOfRecords: options.numberOfRecords ?? 100,
    eventID: eventId,
    lowPrice: options.lowPrice,
    highPrice: options.highPrice,
    ticketGroupID: options.ticketGroupID,
    requestedTixSplit: options.requestedTixSplit,
    whereClause: options.whereClause,
    orderByClause: options.orderByClause,
  };

  const soap = buildSoapEnvelope('GetTickets', params);

  async function requestWithTokenRetry(retryOn401 = true) {
    const token = await getToken(!retryOn401);
    const response = await fetchWithTimeout(SOAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'text/xml',
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetTickets"',
        'Authorization': `Bearer ${token}`,
      },
      body: soap,
    });

    if (response.status === 401 && retryOn401) {
      await getToken(true);
      return requestWithTokenRetry(false);
    }

    return response;
  }

  try {
    const response = await requestWithTokenRetry(true);

    const text = await response.text();

    if (text.trimStart().startsWith('<!DOCTYPE html') || text.trimStart().startsWith('<html')) {
      throw new Error('SOAP endpoint returned HTML. Verify TN_API_BASE/TN_API_URL points to TNWebservice.asmx and credentials are valid.');
    }
    
    if (!response.ok) {
      console.error('SOAP Error:', text.substring(0, 500));
      throw new Error(`SOAP request failed: ${response.status}`);
    }

    let parsed = null;
    let parseError = null;
    try {
      parsed = parseSoapResponse(text, 'GetTickets');
    } catch (error) {
      parseError = error.message;
    }

    return {
      status: response.status,
      xml: text,
      parsed,
      parseError,
    };
  } catch (error) {
    console.error('❌ SOAP GetTickets error:', error.message);
    throw error;
  }
}

export async function getCategoriesMasterList(options = {}) {
  const params = {
    websiteConfigID: options.websiteConfigID ?? WCID,
  };

  const soap = buildSoapEnvelope('GetCategoriesMasterList', params);

  async function requestWithTokenRetry(retryOn401 = true) {
    const token = await getToken(!retryOn401);
    const response = await fetchWithTimeout(SOAP_ENDPOINT, {
      method: 'POST',
      headers: {
        'Accept': 'text/xml',
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetCategoriesMasterList"',
        'Authorization': `Bearer ${token}`,
      },
      body: soap,
    });

    if (response.status === 401 && retryOn401) {
      await getToken(true);
      return requestWithTokenRetry(false);
    }

    return response;
  }

  try {
    const response = await requestWithTokenRetry(true);
    const text = await response.text();

    if (text.trimStart().startsWith('<!DOCTYPE html') || text.trimStart().startsWith('<html')) {
      throw new Error('SOAP endpoint returned HTML. Verify TN_API_BASE/TN_API_URL points to TNWebservice.asmx and credentials are valid.');
    }

    if (!response.ok) {
      console.error('SOAP Error:', text.substring(0, 500));
      throw new Error(`SOAP request failed: ${response.status}`);
    }

    let parsed = null;
    let parseError = null;
    try {
      parsed = parseSoapResponse(text, 'GetCategoriesMasterList');
    } catch (error) {
      parseError = error.message;
    }

    return {
      status: response.status,
      xml: text,
      parsed,
      parseError,
    };
  } catch (error) {
    console.error('❌ SOAP GetCategoriesMasterList error:', error.message);
    throw error;
  }
}
