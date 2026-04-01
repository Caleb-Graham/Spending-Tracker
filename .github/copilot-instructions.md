# Copilot Instructions — Spending Tracker

## Neon Database Safety Rules

This project uses Neon Serverless PostgreSQL with the following branches in project `lucky-leaf-44806158`:

| Branch        | Branch ID                   | Role                               |
| ------------- | --------------------------- | ---------------------------------- |
| `production`  | `br-patient-fog-ae1h39ns`   | Live app data — **NEVER write**    |
| `Testing`     | `br-fancy-hall-aeq4ek7m`    | Test data — **ask before writing** |
| `development` | `br-wild-darkness-aertey9o` | Archived                           |
| `root`        | `br-solitary-leaf-aeby8m7f` | Schema origin                      |

### Rules

1. **Production branch (`production` / `br-patient-fog-ae1h39ns`) — absolute read-only.**
   Never execute INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, CREATE, or any DDL/DML on the production branch. No exceptions, even if the user asks conversationally. If a task would require a production write, stop and explain what needs to happen and ask the user to do it manually or confirm a specific plan first.

2. **Testing branch (`Testing` / `br-fancy-hall-aeq4ek7m`) — ask before any write.**
   Before running any INSERT, UPDATE, DELETE, or schema change on the Testing branch, pause and describe exactly what SQL will be executed and ask for explicit confirmation. Do not proceed until the user says yes.

3. **Reads are always allowed.**
   SELECT queries, EXPLAIN, schema inspection (pg_policies, information_schema, pg_catalog, etc.) may be run freely on any branch without asking.

4. **When in doubt, read only.**
   If it is unclear which branch a tool call targets, treat it as production and do not write.
