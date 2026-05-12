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
// TASK 1: Export NomorAnggota from buku_induk, check in members
// Strategy: dump buku_induk NomorAnggota to CSV, load into ktam_api temp table, join
// ============================================================

// Step 1a: dump buku_induk sample to CSV
console.log('\n=== TASK 1: Export buku_induk NomorAnggota to CSV ===');
const exportSql = `COPY (
  SELECT "NomorAnggota", "Nama", "DAERAH_ID", "PCM_ID", "TanggalMulaiTerhitung"
  FROM buku_induk
  WHERE "NomorAnggota" IS NOT NULL
  LIMIT 50000
) TO 'C:/Temp/buku_induk_sample.csv' WITH CSV HEADER`;
console.log(pg('ktam_v0', exportSql));

// Step 1b: create temp table in ktam_api and import
const createTempSql = `
DROP TABLE IF EXISTS _tmp_buku_induk;
CREATE TEMP TABLE _tmp_buku_induk (
  nomor_anggota text,
  nama text,
  daerah_id text,
  pcm_id text,
  tgl_mulai text
);
COPY _tmp_buku_induk FROM 'C:/Temp/buku_induk_sample.csv' WITH CSV HEADER;
SELECT b.nomor_anggota, b.nama, b.daerah_id, b.pcm_id, b.tgl_mulai, m.id as members_id, m.nbm, m.nama as members_nama
FROM _tmp_buku_induk b
JOIN members m ON m.nbm = b.nomor_anggota::bigint
LIMIT 10;
`;
console.log('\n=== TASK 1: 10 Sample duplikasi (buku_induk JOIN members.nbm) ===');
console.log(pg('ktam_api', createTempSql));

// ============================================================
// TASK 2: Anomali PCM_ID setelah fix leading zero
// ============================================================
console.log('\n=== TASK 2: Anomali setelah leading zero fix ===');
// Cek: apakah PCM_ID = LPAD(DAERAH_ID tanpa leading zero, ...) + suffix
// Formula: tambah leading zero ke PCM_ID sampai panjangnya = panjang DAERAH_ID + sisa
// Logika: jika '0' || PCM_ID LIKE DAERAH_ID || '%' → bisa difix
const anomalySql = `
SELECT
  COUNT(*) FILTER (WHERE "PCM_ID" LIKE "DAERAH_ID" || '%') as normal,
  COUNT(*) FILTER (
    WHERE "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
    AND ('0' || "PCM_ID") LIKE "DAERAH_ID" || '%'
  ) as fixable_1zero,
  COUNT(*) FILTER (
    WHERE "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
    AND ('0' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
    AND ('00' || "PCM_ID") LIKE "DAERAH_ID" || '%'
  ) as fixable_2zero,
  COUNT(*) FILTER (
    WHERE "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
    AND ('0' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
    AND ('00' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
  ) as still_anomaly,
  COUNT(*) as total
FROM buku_induk
WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL;
`;
console.log(pg('ktam_v0', anomalySql));

// ============================================================
// TASK 3: Data yang tidak bisa pakai formula sama sekali
// Kriteria: setelah fix leading zero pun masih tidak match
// ============================================================
console.log('\n=== TASK 3: Sample data yang tidak bisa pakai formula (still_anomaly) ===');
const noFormulaSql = `
SELECT DISTINCT "DAERAH_ID", "PCM_ID", COUNT(*) as jumlah
FROM buku_induk
WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL
  AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
  AND ('0' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
  AND ('00' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
GROUP BY "DAERAH_ID", "PCM_ID"
ORDER BY jumlah DESC
LIMIT 20;
`;
console.log(pg('ktam_v0', noFormulaSql));

console.log('\n=== TASK 3: Total baris yang tidak bisa pakai formula ===');
const noFormulaCountSql = `
SELECT COUNT(*) as total_tidak_bisa_formula
FROM buku_induk
WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL
  AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
  AND ('0' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%'
  AND ('00' || "PCM_ID") NOT LIKE "DAERAH_ID" || '%';
`;
console.log(pg('ktam_v0', noFormulaCountSql));
