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
    return execSync(cmd, { env, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// Setup staging
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _staging_buku_induk;
  CREATE TABLE _staging_buku_induk (nomor_anggota text, nama text);
  COPY _staging_buku_induk FROM 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER;
`));

// Export name mismatch to CSV
console.log('\n=== Export name mismatch to CSV ===');
console.log(pg('ktam_api', `
  COPY (
    SELECT
      b.nomor_anggota,
      b.nama AS nama_buku_induk,
      m.id AS members_id,
      m.nama AS nama_members
    FROM _staging_buku_induk b
    JOIN members m ON m.nbm = b.nomor_anggota::bigint
    WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
    ORDER BY b.nomor_anggota::bigint
  ) TO 'C:/Temp/name_mismatch.csv' WITH CSV HEADER
`));

// Count
console.log('\n=== Total mismatch ===');
console.log(pg('ktam_api', `
  SELECT COUNT(*) FROM _staging_buku_induk b
  JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
`));

// Cleanup
console.log(pg('ktam_api', `DROP TABLE IF EXISTS _staging_buku_induk`));
