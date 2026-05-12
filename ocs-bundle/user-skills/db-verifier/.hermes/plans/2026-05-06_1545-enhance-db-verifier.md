# Plan: Enhance db-verifier skill

## Goal
Make `.agents/skills/db-verifier` more powerful, safer, and easier to use for daily database verification across MySQL/MariaDB, PostgreSQL, and MongoDB on local Windows/Laragon setup.

## Current context
- Skill path: `/mnt/c/Users/redho/.agents/skills/db-verifier`
- Not inside a Git repository, so branch workflow does not apply unless ketua wants to move it into a repo later.
- Current `SKILL.md` is very minimal.
- Current `scripts/query.cjs` uses `execSync` string interpolation; this is fragile for quoting and risky for accidental command injection.
- Existing helper scripts include several one-off migration/rekap scripts that can be documented better.

## Proposed approach
1. Rewrite `SKILL.md` with stronger operational guidance:
   - when to use / when not to use
   - safety rules: default read-only, ask before write/destructive SQL
   - connection assumptions
   - query examples
   - troubleshooting
   - verification checklist
2. Improve `scripts/query.cjs`:
   - use `spawnSync` with args array instead of shell command string
   - support aliases: `mysql`, `mariadb`, `pg`, `postgres`, `postgresql`, `mongo`, `mongodb`
   - add flags:
     - `--list-dbs`
     - `--list-tables`
     - `--describe <table>`
     - `--file <sql-file>`
     - `--json` where practical for PostgreSQL/MySQL output
   - add read-only guard for dangerous queries unless `--write` is passed
   - keep compatibility with old form: `node scripts/query.cjs <type> "<query>" [dbName]`
3. Add a small `README`/examples section inside `SKILL.md` instead of creating too many extra files.
4. Validate by running smoke tests that do not require DB connection:
   - `node scripts/query.cjs --help`
   - blocked destructive query without `--write`
   - argument parsing for old syntax
   - no syntax error via `node --check scripts/query.cjs`

## Files likely to change
- `/mnt/c/Users/redho/.agents/skills/db-verifier/SKILL.md`
- `/mnt/c/Users/redho/.agents/skills/db-verifier/scripts/query.cjs`

## Tests / validation
- `node --check scripts/query.cjs`
- `node scripts/query.cjs --help`
- `node scripts/query.cjs pg "DROP TABLE users" test_db` should be blocked unless `--write`
- If local DB is running, optional smoke:
  - `node scripts/query.cjs pg "SELECT version();" postgres`
  - `node scripts/query.cjs mysql "SELECT VERSION();"`

## Risks / tradeoffs
- Existing one-off scripts may still use hardcoded `execSync`; plan focuses on central `query.cjs` first.
- Windows executable paths are hardcoded; we can later add env overrides like `DBV_PSQL_BIN`, `DBV_MYSQL_BIN`, etc.
- Actual DB smoke tests may fail if services are stopped; that should not block syntax/guard validation.

## Checkpoints
1. Confirm with ketua before editing: proceed on current folder? Since this is not a Git repo, no branch can be created here.
2. Implement skill + script improvements.
3. Run validation.
4. Ask ketua whether to initialize/move this skill into version control or leave as local skill.
