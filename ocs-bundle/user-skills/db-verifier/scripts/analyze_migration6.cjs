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

// ============================================================
// TASK 1: Export ALL buku_induk ke CSV, lalu join di ktam_api
// untuk temukan semua yang namanya berbeda
// ============================================================
console.log('\n=== Export full buku_induk ke CSV ===');
console.log(pg('ktam_v0', `
  COPY (
    SELECT "NomorAnggota", "Nama"
    FROM buku_induk
    WHERE "NomorAnggota" IS NOT NULL
  ) TO 'C:/Temp/buku_induk_full.csv' WITH CSV HEADER
`));

console.log('\n=== Rekap: NBM sama tapi nama berbeda ===');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _tmp_bi;
  CREATE TEMP TABLE _tmp_bi (nomor_anggota text, nama text);
  COPY _tmp_bi FROM 'C:/Temp/buku_induk_full.csv' WITH CSV HEADER;

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

// ============================================================
// TASK 2: Inspect 0.6% anomaly — DAERAH_ID dan PCM_ID
// ============================================================
console.log('\n=== 0.6% anomaly: semua distinct DAERAH_ID + PCM_ID ===');
console.log(pg('ktam_v0', `
  SELECT "DAERAH_ID", "PCM_ID", COUNT(*) as jumlah
  FROM buku_induk
  WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL
    AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
    AND ('0' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
    AND ('00' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
  GROUP BY "DAERAH_ID", "PCM_ID"
  ORDER BY "DAERAH_ID", "PCM_ID"
`));
