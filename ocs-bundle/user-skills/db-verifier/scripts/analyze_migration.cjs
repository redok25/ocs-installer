const { execSync } = require('child_process');

const PSQL = '"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"';
const USER = 'postgres';
const PASS = 'postgre';

function pg(db, sql) {
  const env = { ...process.env, PGPASSWORD: PASS };
  const cmd = `${PSQL} -U ${USER} -d ${db} -t -A -F"|" -c "${sql.replace(/"/g, '\\"')}"`;
  try {
    return execSync(cmd, { env, encoding: 'utf-8' }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// 1. Sample DAERAH_ID and PCM_ID
console.log('\n=== Sample DAERAH_ID & PCM_ID ===');
console.log(pg('ktam_v0', 'SELECT "NomorAnggota","DAERAH_ID","PCM_ID" FROM buku_induk WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL LIMIT 15'));

// 2. Overlap: NomorAnggota already in members.nbm
console.log('\n=== Overlap count (NomorAnggota in members.nbm) ===');
// Cross-db: dump NomorAnggota to temp, then check in ktam_api
// Instead, check via dblink or just count members.nbm range
console.log(pg('ktam_api', 'SELECT COUNT(*) as total_members, MIN(nbm) as min_nbm, MAX(nbm) as max_nbm FROM members'));
console.log(pg('ktam_v0', 'SELECT COUNT(*) as total_buku_induk FROM buku_induk WHERE "NomorAnggota" IS NOT NULL'));

// 3. Sample NomorAnggota format
console.log('\n=== Sample NomorAnggota ===');
console.log(pg('ktam_v0', 'SELECT "NomorAnggota" FROM buku_induk WHERE "NomorAnggota" IS NOT NULL LIMIT 10'));

// 4. Daerah kode samples
console.log('\n=== Daerah kode samples (ktam_api) ===');
console.log(pg('ktam_api', 'SELECT kode FROM daerah LIMIT 10'));

// 5. Check if DAERAH_ID matches daerah.kode
console.log('\n=== DAERAH_ID distinct samples ===');
console.log(pg('ktam_v0', 'SELECT DISTINCT "DAERAH_ID" FROM buku_induk WHERE "DAERAH_ID" IS NOT NULL LIMIT 15'));
