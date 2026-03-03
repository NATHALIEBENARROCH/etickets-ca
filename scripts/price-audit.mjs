import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { getTickets } from '../lib/soapClient.js';

dotenv.config({ path: '.env.local' });

const cases = [
  { case: 'Raptors', query: 'raptors', eventId: 7703845 },
  { case: 'Vegas Show', query: 'vegas shows', eventId: 7692427 },
  { case: 'Baseball', query: 'baseball', eventId: 7710026 },
  { case: 'Concert', query: 'coldplay', eventId: 7640734 },
  { case: 'Toronto GEO sample', query: 'city=Toronto', eventId: 7380491 },
];

function normalizeGroups(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.TicketGroup)) return result.TicketGroup;
  if (result.TicketGroup) return [result.TicketGroup];
  return [];
}

function getMin(values) {
  const clean = values.map((v) => Number(v)).filter((v) => Number.isFinite(v));
  return clean.length ? Math.min(...clean) : null;
}

function esc(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replaceAll('"', '""') + '"';
  }
  return str;
}

async function run() {
  const rows = [];

  for (const c of cases) {
    try {
      const res = await getTickets(c.eventId, { numberOfRecords: 200 });
      const groups = normalizeGroups(res?.parsed?.result);
      const minRetail = getMin(groups.map((g) => g?.RetailPrice));
      const minWholesale = getMin(groups.map((g) => g?.WholesalePrice));

      rows.push({
        case: c.case,
        query: c.query,
        eventId: c.eventId,
        provider_min_retail: minRetail,
        provider_min_wholesale: minWholesale,
        displayed_price: 'N/A (frontend pending)',
        markup_pct: 'N/A',
        groups_count: groups.length,
        parse_error: res?.parseError || '',
        tested_at: new Date().toISOString(),
      });
    } catch (error) {
      rows.push({
        case: c.case,
        query: c.query,
        eventId: c.eventId,
        provider_min_retail: '',
        provider_min_wholesale: '',
        displayed_price: 'N/A (frontend pending)',
        markup_pct: 'N/A',
        groups_count: 0,
        parse_error: error?.message || 'Unknown error',
        tested_at: new Date().toISOString(),
      });
    }
  }

  const headers = [
    'case',
    'query',
    'eventId',
    'provider_min_retail',
    'provider_min_wholesale',
    'displayed_price',
    'markup_pct',
    'groups_count',
    'parse_error',
    'tested_at',
  ];

  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h])).join(','));
  }

  const outDir = path.resolve('docs');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'price-audit.csv');
  fs.writeFileSync(outFile, lines.join('\n') + '\n', 'utf8');

  console.log(`CSV created: ${outFile}`);
  console.table(rows.map((r) => ({ case: r.case, eventId: r.eventId, minRetail: r.provider_min_retail, minWholesale: r.provider_min_wholesale, groups: r.groups_count, error: r.parse_error }))); 
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
