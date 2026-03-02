import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getToken } from './lib/tokenManager.js';

const testUrls = [
  // REST endpoints (JSON)
  'https://api.ticketnetwork.com/Inventory/SearchEvents?searchString=concert',
  'https://api.ticketnetwork.com/Inventory/GetEvent?eventId=1',
  'https://api.ticketnetwork.com/Inventory/GetEvents',
  // SOAP endpoints (XML - probablemente no funcionen para JSON)
  'https://api.ticketnetwork.com/TNWebservices/v4/TNWebservice.asmx/GetEvents',
];

async function testUrl(url) {
  try {
    console.log(`\n🧪 Testando: ${url}`);
    const token = await getToken();
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    });

    console.log(`   Status: ${response.status}`);
    const contentType = response.headers.get('content-type');
    console.log(`   Content-Type: ${contentType}`);
    
    const body = await response.text();
    const preview = body.substring(0, 200).replace(/\n/g, ' ');
    console.log(`   Response: ${preview}...`);
    
    // Intentar parsear como JSON si es posible
    try {
      if (contentType && contentType.includes('json')) {
        const json = JSON.parse(body);
        console.log(`   ✅ JSON válido, keys: ${Object.keys(json).slice(0, 3).join(', ')}`);
      }
    } catch (e) {
      console.log(`   (No JSON, probablemente HTML/XML)`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    if (error.cause) {
      console.error(`   Cause: ${error.cause.message}`);
    }
  }
}

console.log('🚀 Iniciando diagnóstico de endpoints REST...\n');
console.log('Env vars cargados:');
console.log(`  TN_API_BASE: ${process.env.TN_API_BASE}`);
console.log(`  Token URL: ${process.env.TN_TOKEN_URL}`);

console.log('\n--- Testeando URLs ---');
for (const url of testUrls) {
  await testUrl(url);
}

console.log('\n✅ Diagnóstico completado');

