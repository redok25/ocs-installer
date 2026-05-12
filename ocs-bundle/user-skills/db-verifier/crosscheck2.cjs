// Simulasi payment-status: KTAM filter Feb WIB (tanpa subHours), PayMu filter Feb WIB
// Simulasi group-report: KTAM filter Feb subHours(7), PayMu filter Feb+7jam

const { execSync } = require('child_process');

function psql(db, query) {
  const cmd = `"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe" -U postgres -d ${db} -t -A -c "${query.replace(/"/g, '\\"')}"`;
  const env = { ...process.env, PGPASSWORD: 'postgre' };
  return execSync(cmd, { env }).toString().trim().split('\n').map(s => s.trim()).filter(Boolean);
}

// payment-status: query KTAM Feb WIB langsung (00:00 - 23:59)
const ktamPS = psql('ktam_api', "SELECT code FROM transaction WHERE category != 'iuran' AND status = 'scheduled' AND created_at BETWEEN '2026-02-01 00:00:00' AND '2026-02-28 23:59:59'");

// group-report: query KTAM Feb dengan subHours(7) (17:00 Jan31 - 16:59 Feb28)
const ktamGR = psql('ktam_api', "SELECT code FROM transaction WHERE category = 'registration' AND status = 'scheduled' AND created_at BETWEEN '2026-01-31 17:00:00' AND '2026-02-28 16:59:59'");

// Cari yang ada di payment-status tapi tidak di group-report
const grSet = new Set(ktamGR);
const onlyInPS = ktamPS.filter(c => !grSet.has(c));

console.log('KTAM scheduled (payment-status filter):', ktamPS.length);
console.log('KTAM scheduled (group-report filter):', ktamGR.length);
console.log('Only in payment-status:', onlyInPS.length);
if (onlyInPS.length > 0) {
  console.log('Codes:', onlyInPS.slice(0, 20));
}
