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

// Setup staging lagi
pg('ktam_api', `
  DROP TABLE IF EXISTS _staging_buku_induk;
  CREATE TABLE _staging_buku_induk (nomor_anggota text, nama text);
  COPY _staging_buku_induk FROM 'C:/Temp/buku_induk_numeric.csv' WITH CSV HEADER;
`);

// ============================================================
// TASK 1: Nama benar-benar berbeda
// Logika: nama di members TIDAK mengandung kata pertama dari buku_induk
// (bukan sekadar beda format/gelar)
// ============================================================
console.log('\n=== Nama benar-benar berbeda (bukan sekadar format/gelar) ===');
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
      AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b.nama), ' ', 1)) || '%'
    ORDER BY b.nomor_anggota::bigint
  ) TO 'C:/Temp/name_truly_different.csv' WITH CSV HEADER
`));

console.log('\n=== Count truly different ===');
console.log(pg('ktam_api', `
  SELECT COUNT(*) FROM _staging_buku_induk b
  JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE LOWER(TRIM(b.nama)) <> LOWER(TRIM(m.nama))
    AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b.nama), ' ', 1)) || '%'
`));

pg('ktam_api', `DROP TABLE IF EXISTS _staging_buku_induk`);

// ============================================================
// TASK 2: Data yang AKAN DIINSERT tapi terkena anomali kode_cabang
// = buku_induk yang NomorAnggota-nya TIDAK ada di members.nbm
//   DAN PCM_ID tidak bisa pakai formula normal
// ============================================================

// Export buku_induk full untuk task 2
pg('ktam_v0', `
  COPY (
    SELECT "NomorAnggota", "Nama", "DAERAH_ID", "PCM_ID", "TanggalMulaiTerhitung"
    FROM buku_induk
    WHERE "NomorAnggota" ~ '^[0-9]+$'
  ) TO 'C:/Temp/buku_induk_full2.csv' WITH CSV HEADER
`);

pg('ktam_api', `
  DROP TABLE IF EXISTS _staging_full;
  CREATE TABLE _staging_full (nomor_anggota text, nama text, daerah_id text, pcm_id text, tgl_mulai text);
  COPY _staging_full FROM 'C:/Temp/buku_induk_full2.csv' WITH CSV HEADER;
`);

console.log('\n=== Data yang AKAN DIINSERT + terkena anomali kode_cabang ===');
console.log(pg('ktam_api', `
  COPY (
    SELECT
      b.nomor_anggota,
      b.nama,
      b.daerah_id,
      b.pcm_id,
      b.tgl_mulai,
      CASE
        WHEN b.pcm_id LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING(b.pcm_id, LENGTH(b.daerah_id) + 1)
        WHEN ('0' || b.pcm_id) LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING('0' || b.pcm_id, LENGTH(b.daerah_id) + 1)
        WHEN ('00' || b.pcm_id) LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING('00' || b.pcm_id, LENGTH(b.daerah_id) + 1)
        ELSE b.pcm_id
      END AS kode_cabang_derived,
      CASE
        WHEN b.pcm_id LIKE b.daerah_id || '%' THEN 'normal'
        WHEN ('0' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'fix_1zero'
        WHEN ('00' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'fix_2zero'
        ELSE 'anomali_raw'
      END AS status_kode
    FROM _staging_full b
    LEFT JOIN members m ON m.nbm = b.nomor_anggota::bigint
    WHERE m.id IS NULL
      AND b.daerah_id IS NOT NULL AND b.pcm_id IS NOT NULL
      AND b.pcm_id NOT LIKE b.daerah_id || '%'
    ORDER BY b.nomor_anggota::bigint
  ) TO 'C:/Temp/insert_anomali.csv' WITH CSV HEADER
`));

console.log('\n=== Summary status_kode untuk data yang akan diinsert ===');
console.log(pg('ktam_api', `
  SELECT
    CASE
      WHEN b.pcm_id LIKE b.daerah_id || '%' THEN 'normal'
      WHEN ('0' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'fix_1zero'
      WHEN ('00' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'fix_2zero'
      ELSE 'anomali_raw'
    END AS status_kode,
    COUNT(*) as jumlah
  FROM _staging_full b
  LEFT JOIN members m ON m.nbm = b.nomor_anggota::bigint
  WHERE m.id IS NULL
    AND b.daerah_id IS NOT NULL AND b.pcm_id IS NOT NULL
    AND b.pcm_id NOT LIKE b.daerah_id || '%'
  GROUP BY 1
  ORDER BY 2 DESC
`));

pg('ktam_api', `DROP TABLE IF EXISTS _staging_full`);
