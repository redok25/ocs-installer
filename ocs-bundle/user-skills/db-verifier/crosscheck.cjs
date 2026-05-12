const { Client } = require('pg');
const ktam = new Client({ host: 'localhost', user: 'postgres', password: 'postgre', database: 'ktam_api' });
const paymu = new Client({ host: 'localhost', user: 'postgres', password: 'postgre', database: 'paymu_prod' });

async function run() {
  await ktam.connect();
  await paymu.connect();

  const r1 = await ktam.query(
    "SELECT code FROM transaction WHERE category = 'registration' AND status = 'scheduled' AND created_at BETWEEN '2026-01-31 17:00:00' AND '2026-02-28 16:59:59'"
  );
  const codes = r1.rows.map(r => r.code);

  const r2 = await paymu.query(
    'SELECT reference_id FROM payment_gateway_transactions WHERE status = $1 AND reference_id = ANY($2)',
    ['success', codes]
  );

  console.log('KTAM scheduled (filter subHours7):', codes.length);
  console.log('PayMu success match:', r2.rows.length);
  if (r2.rows.length > 0) {
    console.log('Matched codes:', r2.rows.map(r => r.reference_id));
  }

  await ktam.end();
  await paymu.end();
}

run().catch(console.error);
