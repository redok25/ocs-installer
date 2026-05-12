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

// Export only numeric NomorAnggota
console.log('\n=== Export numeric-only NomorAnggota ===');
console.log(pg('ktam_v0', `
  COPY (
    SELECT "NomorAnggota", "Nama"
    FROM buku_induk
    WHERE "NomorAnggota" ~ '^[0-9]+$'
  ) TO 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER
`));

// Check non-numeric NomorAnggota
console.log('\n=== Non-numeric NomorAnggota samples ===');
console.log(pg('ktam_v0', `
  SELECT "NomorAnggota", "Nama" FROM buku_induk
  WHERE "NomorAnggota" !~ '^[0-9]+$'
  LIMIT 10
`));
console.log('\n=== Non-numeric count ===');
console.log(pg('ktam_v0', `SELECT COUNT(*) FROM buku_induk WHERE "NomorAnggota" !~ '^[0-9]+$'`));

// Join and find name mismatches
console.log('\n=== Rekap: NBM sama tapi nama berbeda ===');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _tmp_bi;
  CREATE TEMP TABLE _tmp_bi (nomor_anggota text, nama text);
  COPY _tmp_bi FROM 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER;

  SELECT
    b.nomor_anggota,
    b.nama AS nama_buku_induk,
    m.id AS members_id,
    m.nama AS nama_members
  FROM _tmp_bi b
  JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
  ORDER BY b.nomor_anggota::bigint
`));

console.log('\n=== Total NBM sama tapi nama berbeda ===');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _tmp_bi2;
  CREATE TEMP TABLE _tmp_bi2 (nomor_anggota text, nama text);
  COPY _tmp_bi2 FROM 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER;

  SELECT COUNT(*) FROM _tmp_bi2 b
  JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
`));
