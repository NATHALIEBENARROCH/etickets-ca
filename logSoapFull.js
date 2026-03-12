import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import fs from 'fs';
import { getToken } from './lib/tokenManager.js';

const WCID = parseInt(process.env.TN_WCID || '23933');
const endpoint = 'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx';
const soapAction = 'http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents';

function buildSoapEnvelope() {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">
  <soap:Body>
    <tns:GetEvents>
      <websiteConfigID>${WCID}</websiteConfigID>
      <numberOfEvents>5</numberOfEvents>
      <eventID></eventID>
      <eventName></eventName>
      <eventDate>0001-01-01T00:00:00</eventDate>
      <beginDate>0001-01-01T00:00:00</beginDate>
      <endDate>2099-12-31T23:59:59</endDate>
      <venueID></venueID>
      <venueName></venueName>
      <stateProvDesc></stateProvDesc>
      <stateID></stateID>
      <cityZip></cityZip>
      <nearZip></nearZip>
      <parentCategoryID></parentCategoryID>
      <childCategoryID></childCategoryID>
      <grandchildCategoryID></grandchildCategoryID>
      <performerID></performerID>
      <performerName></performerName>
      <noPerformers>false</noPerformers>
      <lowPrice></lowPrice>
      <highPrice></highPrice>
      <modificationDate>0001-01-01T00:00:00</modificationDate>
      <onlyMine>false</onlyMine>
      <whereClause></whereClause>
      <orderByClause></orderByClause>
    </tns:GetEvents>
  </soap:Body>
</soap:Envelope>`;
}

async function main() {
  const token = await getToken();
  const body = buildSoapEnvelope();

  const requestHeaders = {
    'Content-Type': 'text/xml; charset=utf-8',
    'SOAPAction': soapAction,
    'Authorization': `Bearer ${token}`,
  };

  const requestLog = [
    `METHOD: POST`,
    `URL: ${endpoint}`,
    `HEADERS:`,
    ...Object.entries(requestHeaders).map(([k, v]) => `  ${k}: ${v}`),
    `\nBODY:\n${body}`,
  ].join('\n');

  fs.writeFileSync('soap_request_full.txt', requestLog, 'utf8');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: requestHeaders,
    body,
  });

  const responseText = await response.text();
  const responseHeaders = Array.from(response.headers.entries())
    .map(([k, v]) => `  ${k}: ${v}`)
    .join('\n');

  const responseLog = [
    `STATUS: ${response.status} ${response.statusText}`,
    `HEADERS:`,
    responseHeaders,
    `\nBODY:\n${responseText}`,
  ].join('\n');

  fs.writeFileSync('soap_response_full.txt', responseLog, 'utf8');

  console.log('✅ Logs guardados en soap_request_full.txt y soap_response_full.txt');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
});
