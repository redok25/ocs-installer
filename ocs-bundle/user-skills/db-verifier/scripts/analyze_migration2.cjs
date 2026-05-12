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

// 1. PCM_ID distinct samples
console.log('\n=== PCM_ID distinct samples ===');
console.log(pg('ktam_v0', 'SELECT DISTINCT "PCM_ID" FROM buku_induk WHERE "PCM_ID" IS NOT NULL LIMIT 20'));

// 2. Cabang kode samples in ktam_api
console.log('\n=== Cabang kode samples (ktam_api) ===');
console.log(pg('ktam_api', 'SELECT kode, kode_daerah FROM cabang LIMIT 20'));

// 3. Check overlap: NomorAnggota (numeric) vs members.nbm
// NomorAnggota appears to be numeric string, nbm is bigint
console.log('\n=== NomorAnggota range in buku_induk ===');
console.log(pg('ktam_v0', 'SELECT MIN("NomorAnggota"::bigint), MAX("NomorAnggota"::bigint), COUNT(*) FROM buku_induk WHERE "NomorAnggota" ~ \'^[0-9]+$\''));

// 4. How many NomorAnggota already exist in members.nbm (cross-db via temp table approach)
// We'll check by range overlap
console.log('\n=== members.nbm range ===');
console.log(pg('ktam_api', 'SELECT MIN(nbm), MAX(nbm), COUNT(*) FROM members WHERE nbm IS NOT NULL'));

// 5. Check PCM_ID vs DAERAH_ID relationship - does PCM_ID start with DAERAH_ID?
console.log('\n=== PCM_ID starts with DAERAH_ID? (sample) ===');
console.log(pg('ktam_v0', 'SELECT "DAERAH_ID", "PCM_ID", CASE WHEN "PCM_ID" LIKE "DAERAH_ID" || \'%\' THEN \'yes\' ELSE \'no\' END as starts_with FROM buku_induk WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL LIMIT 10'));

// 6. Derive cabang kode format: DAERAH_ID-[PCM_ID minus DAERAH_ID prefix]
console.log('\n=== Derived cabang kode format ===');
console.log(pg('ktam_v0', 'SELECT DISTINCT "DAERAH_ID", "PCM_ID", "DAERAH_ID" || \'-\' || SUBSTRING("PCM_ID", LENGTH("DAERAH_ID")+1) as derived_kode FROM buku_induk WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL AND "PCM_ID" LIKE "DAERAH_ID" || \'%\' LIMIT 15'));
