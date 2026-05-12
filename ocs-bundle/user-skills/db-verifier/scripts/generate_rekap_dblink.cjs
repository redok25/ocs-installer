const { execSync } = require('child_process');
const fs = require('fs');
const PSQL = '"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"';
const USER = 'postgres';
const PASS = 'postgre';

function pg(db, sql) {
  const env = { ...process.env, PGPASSWORD: PASS };
  fs.writeFileSync('C:\\Temp\\tmp_query.sql', sql);
  const cmd = `${PSQL} -U ${USER} -d ${db} -f "C:\\Temp\\tmp_query.sql"`;
  try {
    return execSync(cmd, { env, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// Step 1: Enable dblink
console.log('Step 1: Enable dblink...');
console.log(pg('ktam_api', `CREATE EXTENSION IF NOT EXISTS dblink;`));

// Step 2: Create rekap table via dblink
console.log('Step 2: Creating rekap table (this may take a while)...');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS rekap_migrasi_buku_induk;

  CREATE TABLE rekap_migrasi_buku_induk AS
  SELECT
    b."NomorAnggota"  AS nomor_anggota,
    b."Nama"          AS nama,
    b."DAERAH_ID"     AS daerah_id,
    b."PCM_ID"        AS pcm_id,
    b."TanggalMulaiTerhitung" AS tgl_mulai,
    b."TanggalInputData"      AS tgl_input,
    b."AlamatNama"    AS alamat,
    b."Kelurahan"     AS kelurahan,
    b."KOTA"          AS kota,
    b."NoTelponRumah" AS telp_rumah,
    b."NoTelponKantor" AS telp_kantor,
    b."Keterangan"    AS keterangan,
    b."JenisKelamin"  AS jenis_kelamin,
    b."TempatLahir"   AS tempat_lahir,
    b."TanggalLahir"  AS tanggal_lahir,

    -- nbm_final
    CASE
      WHEN b."NomorAnggota" ~ '^[0-9]+$' THEN b."NomorAnggota"
      WHEN b."NomorAnggota" LIKE '%,%' THEN SPLIT_PART(b."NomorAnggota", ',', 2)
      ELSE NULL
    END AS nbm_final,

    -- kode_cabang_derived
    CASE
      WHEN b."DAERAH_ID" IS NULL OR b."PCM_ID" IS NULL THEN NULL
      WHEN b."PCM_ID" LIKE b."DAERAH_ID" || '%'
        THEN b."DAERAH_ID" || '-' || SUBSTRING(b."PCM_ID", LENGTH(b."DAERAH_ID") + 1)
      WHEN ('0' || b."PCM_ID") LIKE b."DAERAH_ID" || '%'
        THEN b."DAERAH_ID" || '-' || SUBSTRING('0' || b."PCM_ID", LENGTH(b."DAERAH_ID") + 1)
      WHEN ('00' || b."PCM_ID") LIKE b."DAERAH_ID" || '%'
        THEN b."DAERAH_ID" || '-' || SUBSTRING('00' || b."PCM_ID", LENGTH(b."DAERAH_ID") + 1)
      ELSE b."PCM_ID"
    END AS kode_cabang_derived,

    -- aksi
    CASE
      WHEN b."NomorAnggota" LIKE '%,%' THEN
        CASE WHEN EXISTS (SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b."NomorAnggota",',',2)::bigint)
          THEN 'SKIP' ELSE 'INSERT' END
      WHEN b."NomorAnggota" ~ '^[0-9]+$' THEN
        CASE WHEN EXISTS (SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint)
          THEN 'SKIP' ELSE 'INSERT' END
      ELSE 'SKIP'
    END AS aksi,

    -- jenis_data
    CASE
      WHEN b."NomorAnggota" LIKE '%,%' THEN
        CASE WHEN EXISTS (SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b."NomorAnggota",',',2)::bigint)
          THEN 'non_numeric_skip' ELSE 'non_numeric_insert' END
      WHEN b."NomorAnggota" ~ '^[0-9]+$' AND EXISTS (SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint) THEN
        CASE WHEN EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint
            AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b."Nama"),' ',1)) || '%'
        ) THEN 'duplikat_beda_nama' ELSE 'duplikat' END
      WHEN b."NomorAnggota" ~ '^[0-9]+$' THEN
        CASE
          WHEN b."DAERAH_ID" IS NULL OR b."PCM_ID" IS NULL THEN 'normal'
          WHEN b."PCM_ID" LIKE b."DAERAH_ID" || '%' THEN 'normal'
          WHEN ('0'||b."PCM_ID") LIKE b."DAERAH_ID"||'%' OR ('00'||b."PCM_ID") LIKE b."DAERAH_ID"||'%' THEN 'leading_zero'
          ELSE 'anomali_kode'
        END
      ELSE 'non_numeric_skip'
    END AS jenis_data,

    -- sumber_masalah
    CASE
      WHEN b."NomorAnggota" LIKE '%,%' AND EXISTS (SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b."NomorAnggota",',',2)::bigint)
        THEN 'NomorAnggota format desimal, nilai sesudah koma sudah ada di members'
      WHEN b."NomorAnggota" LIKE '%,%'
        THEN 'NomorAnggota format desimal, nilai sesudah koma belum ada di members'
      WHEN b."NomorAnggota" ~ '^[0-9]+$' AND EXISTS (
        SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint
          AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b."Nama"),' ',1)) || '%'
      ) THEN 'NBM sudah ada di members dengan nama berbeda total, kemungkinan NBM di-recycle'
      WHEN b."NomorAnggota" ~ '^[0-9]+$' AND EXISTS (SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint)
        THEN 'NBM sudah ada di members, nama sama atau beda format/gelar'
      WHEN b."DAERAH_ID" IS NOT NULL AND b."PCM_ID" IS NOT NULL
        AND b."PCM_ID" NOT LIKE b."DAERAH_ID"||'%'
        AND ('0'||b."PCM_ID") NOT LIKE b."DAERAH_ID"||'%'
        AND ('00'||b."PCM_ID") NOT LIKE b."DAERAH_ID"||'%'
        THEN 'PCM_ID tidak berkaitan dengan DAERAH_ID, kemungkinan salah input cabang'
      WHEN b."DAERAH_ID" IS NOT NULL AND b."PCM_ID" IS NOT NULL
        AND b."PCM_ID" NOT LIKE b."DAERAH_ID"||'%'
        AND (('0'||b."PCM_ID") LIKE b."DAERAH_ID"||'%' OR ('00'||b."PCM_ID") LIKE b."DAERAH_ID"||'%')
        THEN 'PCM_ID kehilangan leading zero saat input'
      ELSE NULL
    END AS sumber_masalah,

    -- proses
    CASE
      WHEN b."NomorAnggota" LIKE '%,%' AND EXISTS (SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b."NomorAnggota",',',2)::bigint)
        THEN 'SKIP - nilai sesudah koma adalah NBM yang benar, sudah ada di members'
      WHEN b."NomorAnggota" LIKE '%,%'
        THEN 'INSERT - nbm diisi nilai sesudah koma'
      WHEN b."NomorAnggota" ~ '^[0-9]+$' AND EXISTS (
        SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint
          AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b."Nama"),' ',1)) || '%'
      ) THEN 'SKIP - data di members adalah yang aktif, buku_induk tidak relevan'
      WHEN b."NomorAnggota" ~ '^[0-9]+$' AND EXISTS (SELECT 1 FROM members m WHERE m.nbm = b."NomorAnggota"::bigint)
        THEN 'SKIP - data di members lebih lengkap dan valid'
      WHEN b."DAERAH_ID" IS NOT NULL AND b."PCM_ID" IS NOT NULL
        AND b."PCM_ID" NOT LIKE b."DAERAH_ID"||'%'
        AND ('0'||b."PCM_ID") NOT LIKE b."DAERAH_ID"||'%'
        AND ('00'||b."PCM_ID") NOT LIKE b."DAERAH_ID"||'%'
        THEN 'INSERT - kode_cabang diisi PCM_ID mentah, perlu verifikasi manual post-migrasi'
      WHEN b."DAERAH_ID" IS NOT NULL AND b."PCM_ID" IS NOT NULL
        AND b."PCM_ID" NOT LIKE b."DAERAH_ID"||'%'
        AND (('0'||b."PCM_ID") LIKE b."DAERAH_ID"||'%' OR ('00'||b."PCM_ID") LIKE b."DAERAH_ID"||'%')
        THEN 'INSERT - PCM_ID dipadding leading zero sebelum formula dijalankan'
      ELSE 'INSERT - kode_cabang = DAERAH_ID-[suffix PCM_ID]'
    END AS proses

  FROM dblink(
    'dbname=ktam_v0 user=postgres password=postgre host=localhost',
    'SELECT "NomorAnggota","Nama","DAERAH_ID","PCM_ID","TanggalMulaiTerhitung","TanggalInputData","AlamatNama","Kelurahan","KOTA","NoTelponRumah","NoTelponKantor","Keterangan","JenisKelamin","TempatLahir","TanggalLahir" FROM buku_induk'
  ) AS b(
    "NomorAnggota" text, "Nama" text, "DAERAH_ID" text, "PCM_ID" text,
    "TanggalMulaiTerhitung" text, "TanggalInputData" text,
    "AlamatNama" text, "Kelurahan" text, "KOTA" text,
    "NoTelponRumah" text, "NoTelponKantor" text, "Keterangan" text,
    "JenisKelamin" text, "TempatLahir" text, "TanggalLahir" text
  );
`));

// Summary
console.log('Summary:');
console.log(pg('ktam_api', `
  SELECT aksi, jenis_data, COUNT(*) as jumlah
  FROM rekap_migrasi_buku_induk
  GROUP BY aksi, jenis_data
  ORDER BY aksi, jumlah DESC;
`));

console.log('Done! Tabel rekap_migrasi_buku_induk siap di ktam_api.');
