const { execSync } = require('child_process');
const PSQL = '"C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe"';
const USER = 'postgres';
const PASS = 'postgre';

function pg(db, sql) {
  const env = { ...process.env, PGPASSWORD: PASS };
  // Write to temp file to avoid quoting issues
  const fs = require('fs');
  const tmpFile = 'C:\\Temp\\tmp_query.sql';
  fs.writeFileSync(tmpFile, sql);
  const cmd = `${PSQL} -U ${USER} -d ${db} -t -A -F"|" -f "${tmpFile}"`;
  try {
    return execSync(cmd, { env, encoding: 'utf-8' }).trim();
  } catch (e) {
    return `ERROR: ${e.stderr || e.message}`;
  }
}

// 1. PCM_ID that does NOT start with DAERAH_ID
console.log('\n=== PCM_ID NOT starting with DAERAH_ID (count) ===');
console.log(pg('ktam_v0', `
  SELECT COUNT(*) FROM buku_induk 
  WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL 
  AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
`));

// 2. Sample of those anomalies
console.log('\n=== Sample anomalies ===');
console.log(pg('ktam_v0', `
  SELECT DISTINCT "DAERAH_ID", "PCM_ID" FROM buku_induk 
  WHERE "DAERAH_ID" IS NOT NULL AND "PCM_ID" IS NOT NULL 
  AND "PCM_ID" NOT LIKE "DAERAH_ID" || '%'
  LIMIT 10
`));

// 3. Overlap: NomorAnggota already in members.nbm
// Use dblink or temp table - we'll use a file-based approach
// Export NomorAnggota from ktam_v0, check against ktam_api
console.log('\n=== NomorAnggota NULL count ===');
console.log(pg('ktam_v0', `SELECT COUNT(*) FROM buku_induk WHERE "NomorAnggota" IS NULL`));

// 4. Check if cabang kode format DAERAH_ID-XX exists in ktam_api
console.log('\n=== Sample derived kode vs cabang.kode match ===');
console.log(pg('ktam_v0', `
  SELECT COUNT(DISTINCT b."PCM_ID") as total_pcm,
    COUNT(DISTINCT CASE WHEN b."PCM_ID" LIKE b."DAERAH_ID" || '%' THEN b."PCM_ID" END) as starts_with_daerah
  FROM buku_induk b
  WHERE b."DAERAH_ID" IS NOT NULL AND b."PCM_ID" IS NOT NULL
`));
