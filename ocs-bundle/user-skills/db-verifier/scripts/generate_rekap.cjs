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

// STEP 1: Export full buku_induk (numeric + non-numeric) ke CSV
console.log('Step 1: Export buku_induk...');
console.log(pg('ktam_v0', `
  COPY (
    SELECT
      "NomorAnggota",
      "Nama",
      "DAERAH_ID",
      "PCM_ID",
      "TanggalMulaiTerhitung",
      "TanggalInputData",
      "AlamatNama",
      "Kelurahan",
      "KOTA",
      "NoTelponRumah",
      "NoTelponKantor",
      "Keterangan",
      "JenisKelamin",
      "TempatLahir",
      "TanggalLahir"
    FROM buku_induk
  ) TO 'C:/Temp/buku_induk_rekap.csv' WITH CSV HEADER
`));

// STEP 2: Setup staging table di ktam_api
console.log('Step 2: Setup staging table...');
console.log(pg('ktam_api', `
  DROP TABLE IF EXISTS _staging_rekap;
  CREATE TABLE _staging_rekap (
    nomor_anggota text,
    nama text,
    daerah_id text,
    pcm_id text,
    tgl_mulai text,
    tgl_input text,
    alamat text,
    kelurahan text,
    kota text,
    telp_rumah text,
    telp_kantor text,
    keterangan text,
    jenis_kelamin text,
    tempat_lahir text,
    tanggal_lahir text
  );
  COPY _staging_rekap FROM 'C:/Temp/buku_induk_rekap.csv' WITH CSV HEADER;
`));

// STEP 3: Generate rekap dengan semua kolom tambahan
console.log('Step 3: Generate rekap CSV...');
console.log(pg('ktam_api', `
  COPY (
    SELECT
      b.nomor_anggota,
      b.nama,
      b.daerah_id,
      b.pcm_id,
      b.tgl_mulai,
      b.tgl_input,
      b.alamat,
      b.kelurahan,
      b.kota,
      b.telp_rumah,
      b.telp_kantor,
      b.keterangan,
      b.jenis_kelamin,
      b.tempat_lahir,
      b.tanggal_lahir,

      -- kode_cabang_derived
      CASE
        WHEN b.daerah_id IS NULL OR b.pcm_id IS NULL THEN NULL
        WHEN b.pcm_id LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING(b.pcm_id, LENGTH(b.daerah_id) + 1)
        WHEN ('0' || b.pcm_id) LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING('0' || b.pcm_id, LENGTH(b.daerah_id) + 1)
        WHEN ('00' || b.pcm_id) LIKE b.daerah_id || '%'
          THEN b.daerah_id || '-' || SUBSTRING('00' || b.pcm_id, LENGTH(b.daerah_id) + 1)
        ELSE b.pcm_id
      END AS kode_cabang_derived,

      -- nbm_final (nilai NBM yang akan dipakai)
      CASE
        WHEN b.nomor_anggota ~ '^[0-9]+$' THEN b.nomor_anggota
        WHEN b.nomor_anggota LIKE '%,%' THEN SPLIT_PART(b.nomor_anggota, ',', 2)
        ELSE NULL
      END AS nbm_final,

      -- aksi
      CASE
        -- non-numeric: cek nilai sesudah koma
        WHEN b.nomor_anggota NOT LIKE '%[^0-9]%' AND b.nomor_anggota LIKE '%,%' THEN
          CASE
            WHEN EXISTS (
              SELECT 1 FROM members m
              WHERE m.nbm = SPLIT_PART(b.nomor_anggota, ',', 2)::bigint
            ) THEN 'SKIP'
            ELSE 'INSERT'
          END
        -- numeric: cek di members
        WHEN b.nomor_anggota ~ '^[0-9]+$' THEN
          CASE
            WHEN EXISTS (
              SELECT 1 FROM members m WHERE m.nbm = b.nomor_anggota::bigint
            ) THEN 'SKIP'
            ELSE 'INSERT'
          END
        ELSE 'SKIP'
      END AS aksi,

      -- jenis_data
      CASE
        -- non-numeric
        WHEN b.nomor_anggota LIKE '%,%' THEN
          CASE
            WHEN EXISTS (
              SELECT 1 FROM members m
              WHERE m.nbm = SPLIT_PART(b.nomor_anggota, ',', 2)::bigint
            ) THEN 'non_numeric_skip'
            ELSE 'non_numeric_insert'
          END
        -- numeric duplikat
        WHEN b.nomor_anggota ~ '^[0-9]+$' AND EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = b.nomor_anggota::bigint
        ) THEN
          CASE
            WHEN EXISTS (
              SELECT 1 FROM members m
              WHERE m.nbm = b.nomor_anggota::bigint
                AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b.nama), ' ', 1)) || '%'
            ) THEN 'duplikat_beda_nama'
            ELSE 'duplikat'
          END
        -- numeric insert
        WHEN b.nomor_anggota ~ '^[0-9]+$' THEN
          CASE
            WHEN b.daerah_id IS NULL OR b.pcm_id IS NULL THEN 'normal'
            WHEN b.pcm_id LIKE b.daerah_id || '%' THEN 'normal'
            WHEN ('0' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'leading_zero'
            WHEN ('00' || b.pcm_id) LIKE b.daerah_id || '%' THEN 'leading_zero'
            ELSE 'anomali_kode'
          END
        ELSE 'non_numeric_skip'
      END AS jenis_data,

      -- sumber_masalah
      CASE
        WHEN b.nomor_anggota LIKE '%,%' AND EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b.nomor_anggota, ',', 2)::bigint
        ) THEN 'NomorAnggota mengandung koma desimal, nilai sesudah koma sudah ada di members'
        WHEN b.nomor_anggota LIKE '%,%' THEN 'NomorAnggota mengandung koma desimal, nilai sesudah koma belum ada di members'
        WHEN b.nomor_anggota ~ '^[0-9]+$' AND EXISTS (
          SELECT 1 FROM members m
          WHERE m.nbm = b.nomor_anggota::bigint
            AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b.nama), ' ', 1)) || '%'
        ) THEN 'NBM sudah terdaftar di members dengan nama berbeda total, kemungkinan NBM di-recycle'
        WHEN b.nomor_anggota ~ '^[0-9]+$' AND EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = b.nomor_anggota::bigint
        ) THEN 'NBM sudah terdaftar di members, nama sama atau beda format/gelar'
        WHEN b.pcm_id NOT LIKE b.daerah_id || '%'
          AND ('0' || b.pcm_id) NOT LIKE b.daerah_id || '%'
          AND ('00' || b.pcm_id) NOT LIKE b.daerah_id || '%'
          AND b.daerah_id IS NOT NULL AND b.pcm_id IS NOT NULL
          THEN 'PCM_ID tidak berkaitan dengan DAERAH_ID, kemungkinan salah input cabang'
        WHEN b.pcm_id IS NOT NULL AND b.daerah_id IS NOT NULL
          AND b.pcm_id NOT LIKE b.daerah_id || '%'
          AND (('0' || b.pcm_id) LIKE b.daerah_id || '%' OR ('00' || b.pcm_id) LIKE b.daerah_id || '%')
          THEN 'PCM_ID kehilangan leading zero saat input'
        ELSE NULL
      END AS sumber_masalah,

      -- proses
      CASE
        WHEN b.nomor_anggota LIKE '%,%' AND EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = SPLIT_PART(b.nomor_anggota, ',', 2)::bigint
        ) THEN 'SKIP - disimpulkan nilai sesudah koma adalah NBM yang benar'
        WHEN b.nomor_anggota LIKE '%,%' THEN 'INSERT dengan nbm = nilai sesudah koma'
        WHEN b.nomor_anggota ~ '^[0-9]+$' AND EXISTS (
          SELECT 1 FROM members m
          WHERE m.nbm = b.nomor_anggota::bigint
            AND LOWER(m.nama) NOT LIKE '%' || LOWER(SPLIT_PART(TRIM(b.nama), ' ', 1)) || '%'
        ) THEN 'SKIP - data di members adalah yang aktif, data lama di buku_induk tidak relevan'
        WHEN b.nomor_anggota ~ '^[0-9]+$' AND EXISTS (
          SELECT 1 FROM members m WHERE m.nbm = b.nomor_anggota::bigint
        ) THEN 'SKIP - data di members lebih lengkap dan valid'
        WHEN b.pcm_id NOT LIKE b.daerah_id || '%'
          AND ('0' || b.pcm_id) NOT LIKE b.daerah_id || '%'
          AND ('00' || b.pcm_id) NOT LIKE b.daerah_id || '%'
          AND b.daerah_id IS NOT NULL AND b.pcm_id IS NOT NULL
          THEN 'INSERT - kode_cabang diisi PCM_ID mentah, perlu verifikasi manual post-migrasi'
        WHEN b.pcm_id IS NOT NULL AND b.daerah_id IS NOT NULL
          AND b.pcm_id NOT LIKE b.daerah_id || '%'
          AND (('0' || b.pcm_id) LIKE b.daerah_id || '%' OR ('00' || b.pcm_id) LIKE b.daerah_id || '%')
          THEN 'INSERT - PCM_ID dipadding leading zero sebelum formula dijalankan'
        ELSE 'INSERT langsung, kode_cabang = DAERAH_ID-[suffix PCM_ID]'
      END AS proses

    FROM _staging_rekap b
    ORDER BY
      CASE WHEN b.nomor_anggota ~ '^[0-9]+$' THEN b.nomor_anggota::bigint ELSE 9999999 END
  ) TO 'C:/Temp/rekap_buku_induk.csv' WITH CSV HEADER
`));

console.log('Step 4: Cleanup...');
console.log(pg('ktam_api', `DROP TABLE IF EXISTS _staging_rekap`));
console.log('Done!');
