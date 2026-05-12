---
name: db-verifier
description: Database verification and querying for MySQL, PostgreSQL, and MongoDB. Use when asked to check database tables, verify data, or run SQL/NoSQL queries on local instances.
---

# Database Verifier

Specialized skill for executing queries against local MySQL (MariaDB), PostgreSQL, and MongoDB instances using pre-configured credentials and paths.

## Supported Databases

- **MySQL / MariaDB**: root@localhost (no password)
- **PostgreSQL**: postgres@localhost (pass: postgre)
- **MongoDB**: Local instance at C:\Program Files\MongoDB

## Usage Patterns

Trigger this skill by asking to verify database contents or run queries.

### Examples

- "Check the `users` table in the `ktam` MySQL database."
- "Show all rows from `members` in PostgreSQL."
- "List collections in MongoDB."
- "Verify if the latest migration was applied in PG."

## Internal Workflow

The skill uses a Node.js helper script to execute commands:

`node scripts/query.cjs <type> "<query>" [dbName]`

- `<type>`: `mysql`, `pg`, or `mongo`
- `<query>`: The SQL or MongoDB eval string.
- `[dbName]`: (Optional) The database name to connect to.

### MySQL Example
`node scripts/query.cjs mysql "SELECT * FROM users LIMIT 5" ktam_db`

### PostgreSQL Example
`node scripts/query.cjs pg "SELECT version();"`

### MongoDB Example
`node scripts/query.cjs mongo "db.getCollectionNames()"`
