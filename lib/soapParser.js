import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
  parseTagValue: true,
  parseAttributeValue: true,
  trimValues: true,
});

function getEnvelope(parsed) {
  return (
    parsed.Envelope ||
    parsed['soap:Envelope'] ||
    parsed['soapenv:Envelope'] ||
    parsed['S:Envelope'] ||
    parsed
  );
}

function getBody(envelope) {
  return (
    envelope.Body ||
    envelope['soap:Body'] ||
    envelope['soapenv:Body'] ||
    envelope['S:Body']
  );
}

export function parseSoapResponse(xml, methodName) {
  const parsed = parser.parse(xml);
  const envelope = getEnvelope(parsed);
  const body = getBody(envelope) || {};

  if (!methodName) {
    return { raw: parsed, body };
  }

  const responseKey = `${methodName}Response`;
  const resultKey = `${methodName}Result`;
  const response = body[responseKey] || body;
  const result = response ? response[resultKey] : undefined;

  return { raw: parsed, body, result };
}
