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

// 3 non-numeric: 191387,0144 | 198234,959 | 207365,5518
// Cek bagian sebelum koma dan sesudah koma di members.nbm
console.log(pg('ktam_api', `
  SELECT nbm, nama FROM members
  WHERE nbm IN (191387, 144, 198234, 959, 207365, 5518)
  ORDER BY nbm
`));
