import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getToken } from './lib/tokenManager.js';

const WCID = parseInt(process.env.TN_WCID || '23933');

// Diferentes URLs y headers SOAP a intentar
const testCases = [
  {
    name: 'API TicketNetwork - Ruta TNWebservices',
    url: 'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx',
    soapAction: 'http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents'
  },
  {
    name: 'API TicketNetwork - Ruta alternativa /ws',
    url: 'https://api.ticketnetwork.com/ws/TNWebservice.asmx',
    soapAction: 'http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents'
  },
  {
    name: 'TicketNetwork directo',
    url: 'https://webservices.ticketnetwork.com/TNWebservice.asmx',
    soapAction: 'http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0/GetEvents'
  },
];

function buildSoapEnvelope(method) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://tnwebservices.ticketnetwork.com/tnwebservice/v4.0">
  <soap:Body>
    <tns:${method}>
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
    </tns:${method}>
  </soap:Body>
</soap:Envelope>`;
}

async function testEndpoint(testCase) {
  console.log(`\n🧪 Testando: ${testCase.name}`);
  console.log(`   URL: ${testCase.url}`);
  
  try {
    const token = await getToken();
    const soap = buildSoapEnvelope('GetEvents');
    
    const response = await fetch(testCase.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': testCase.soapAction,
        'Authorization': `Bearer ${token}`,
      },
      body: soap,
    });

    console.log(`   Status: ${response.status}`);
    const contentType = response.headers.get('content-type');
    console.log(`   Content-Type: ${contentType}`);
    
    const text = await response.text();
    const isXml = text.includes('<?xml') || text.includes('<soap:');
    const isHtml = text.includes('<!DOCTYPE html') || text.includes('<html');
    
    if (isXml) {
      console.log(`   ✅ Devuelve XML SOAP`);
      console.log(`   Preview: ${text.substring(0, 300)}...`);
    } else if (isHtml) {
      console.log(`   ❌ Devuelve HTML (página de error)`);
    } else {
      console.log(`   ❓ Formato desconocido`);
      console.log(`   Preview: ${text.substring(0, 200)}...`);
    }
    
  } catch (error) {
    console.error(`   ❌ Error de conexión: ${error.message}`);
    if (error.cause) {
      console.error(`   Causa: ${error.cause.message}`);
    }
  }
}

console.log('🚀 Probando diferentes endpoints SOAP...\n');
console.log(`WCID: ${WCID}`);
console.log(`Token URL: ${process.env.TN_TOKEN_URL}`);

for (const testCase of testCases) {
  await testEndpoint(testCase);
}

console.log('\n✅ Pruebas completadas');
console.log('\n💡 Si todos devuelven HTML, necesitas:');
console.log('   1. Confirmar endpoint correcto con Ian');
console.log('   2. Verificar si hay header adicional requerido');
console.log('   3. Revisar documentación oficial de TicketNetwork');
