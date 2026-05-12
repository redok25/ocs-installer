const { execSync } = require('child_process');
const fs = require('fs');
const PSQL = '"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"';
const USER = 'postgres';
const PASS = 'postgre';

function pg(db, sql) {
  const env = { ...process.env, PGPASSWORD: PASS };
  fs.writeFileSync('C:\\Temp\\tmp_query.sql', sql);
  const cmd = `${PSQL} -U ${USER} -d ${db} -t -A -F"|" -f "C:\\Temp\\tmp_query.sql"`;
  try {
    return execSync(cmd, { env, encoding: 'utf-8' }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// Create permanent staging table in ktam_api
console.log('\n=== Setup staging table ===');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _staging_buku_induk;
  CREATE TABLE _staging_buku_induk (nomor_anggota text, nama text);
  COPY _staging_buku_induk FROM 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER;
`));

// Name mismatch rekap
console.log('\n=== Rekap: NBM sama tapi nama berbeda (semua) ===');
console.log(pg('ktam_api', `
  SELECT
    b.nomor_anggota,
    b.nama AS nama_buku_induk,
    m.id AS members_id,
    m.nama AS nama_members
  FROM _staging_buku_induk b
  JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
  ORDER BY b.nomor_anggota::bigint
`));

// Cleanup
console.log('\n=== Cleanup ===');
console.log(pg('ktam_api', `DROP TABLE IF EXISTS _staging_buku_induk`));
