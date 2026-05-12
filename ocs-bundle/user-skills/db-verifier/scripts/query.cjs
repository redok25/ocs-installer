const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    mysql: {
        bin: 'C:\\laragon\\bin\\mysql\\mariadb-11.5.2-winx64\\bin\\mysql.exe',
        user: 'root',
        pass: ''
    },
    pg: {
        bin: 'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe',
        user: 'postgres',
        pass: 'postgre'
    },
    mongo: {
        dir: 'C:\\Program Files\\MongoDB\\Server\\7.0\\bin'
    }
};

function runQuery(type, query, dbName) {
    let command = '';
    let env = { ...process.env };

    switch (type.toLowerCase()) {
        case 'mysql':
        case 'mariadb':
            command = `"${CONFIG.mysql.bin}" -u ${CONFIG.mysql.user} ${CONFIG.mysql.pass ? `-p${CONFIG.mysql.pass}` : ''} ${dbName || ''} -e "${query.replace(/"/g, '\\"')}"`;
            break;
        case 'pg':
        case 'postgres':
        case 'postgresql':
            env.PGPASSWORD = CONFIG.pg.pass;
            command = `"${CONFIG.pg.bin}" -U ${CONFIG.pg.user} ${dbName ? `-d ${dbName}` : ''} -c "${query.replace(/"/g, '\\"')}"`;
            break;
        case 'mongo':
        case 'mongodb':
            const mongosh = path.join(CONFIG.mongo.dir, 'mongosh.exe');
            const mongo = path.join(CONFIG.mongo.dir, 'mongo.exe');
            const bin = fs.existsSync(mongosh) ? mongosh : (fs.existsSync(mongo) ? mongo : 'mongosh');
            command = `"${bin}" --eval "${query.replace(/"/g, '\\"')}" ${dbName || ''}`;
            break;
        default:
            throw new Error(`Unsupported database type: ${type}`);
    }

    try {
        const output = execSync(command, { env, encoding: 'utf-8', stdio: 'pipe' });
        return output;
    } catch (error) {
        return `Error executing ${type} query:\n${error.stderr || error.message}`;
    }
}

const [,, type, query, dbName] = process.argv;

if (!type || !query) {
    console.log('Usage: node query.cjs <type> <query> [dbName]');
    process.exit(1);
}

console.log(runQuery(type, query, dbName));
