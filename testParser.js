import { parseSoapResponse } from './lib/soapParser.js';

const sampleXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetEventsResponse xmlns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">
      <GetEventsResult>
        <Event>
          <ID>123</ID>
          <Name>Sample Event</Name>
          <City>Montreal</City>
          <Date>2026-02-09T20:00:00</Date>
        </Event>
      </GetEventsResult>
    </GetEventsResponse>
  </soap:Body>
</soap:Envelope>`;

const parsed = parseSoapResponse(sampleXml, 'GetEvents');
console.log('Parsed result preview:', JSON.stringify(parsed.result, null, 2));
