import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { getEvents } from './lib/soapClient.js';

console.log('🧪 Testando SOAP GetEvents...\n');

try {
  console.log('📡 Enviando request SOAP a TicketNetwork...');
  const result = await getEvents({ numberOfEvents: 10 });
  
  console.log(`✅ Status: ${result.status}`);
  console.log(`\n📄 XML Response (primeros 1500 chars):\n`);
  console.log(result.xml.substring(0, 1500));
  
  if (result.xml.length > 1500) {
    console.log('\n... (más contenido truncado)');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  if (error.cause) {
    console.error('   Causa:', error.cause.message);
  }
}
