const { execSync } = require('child_process');
const fs = require('fs');
const PSQL = '"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"';
const USER = 'postgres';
const PASS = 'postgre';

function pg(db, sql) {
  const env = { ...process.env, PGPASSWORD: PASS };
  const tmpFile = 'C:\\Temp\\tmp_query.sql';
  fs.writeFileSync(tmpFile, sql);
  const cmd = `${PSQL} -U ${USER} -d ${db} -t -A -F"|" -f "${tmpFile}"`;
  try {
    return execSync(cmd, { env, encoding: 'utf-8' }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// 1. Export NomorAnggota from ktam_v0 to temp table in ktam_api via file
// Since cross-db query isn't direct, export to CSV then check
console.log('\n=== 10 Sample NomorAnggota that likely overlap (low nbm range) ===');
// members.nbm range: 0 - 1704453, buku_induk NomorAnggota: 1 - 1117133
// Show 10 from buku_induk where NomorAnggota is in range of members.nbm
console.log(pg('ktam_v0', `
  SELECT "NomorAnggota", "Nama", "DAERAH_ID", "PCM_ID", "TanggalMulaiTerhitung"
  FROM buku_induk
  WHERE "NomorAnggota"::bigint BETWEEN 1 AND 1704453
  LIMIT 10
`));

// 2. Anomaly samples - PCM_ID not starting with DAERAH_ID
console.log('\n=== Anomaly PCM_ID samples (distinct, 20 rows) ===');
console.log(pg('ktam_v0', `
  SELECT DISTINCT "DAERAH_ID", "PCM_ID", COUNT(*) as jumlah
  FROM buku_induk 
  WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL 
  AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
  GROUP BY "DAERAH_ID", "PCM_ID"
  ORDER BY jumlah DESC
  LIMIT 20
`));
