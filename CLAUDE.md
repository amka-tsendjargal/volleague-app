@AGENTS.md
# CLAUDE.md

Instructions for Claude when working in this codebase.

## Naming Conventions

### TypeScript
- All function names, variables, parameters, and properties must use **camelCase**.
  - Example: `getUserPreferences`, `jerseyId`, `isActive`

### Database (tables, columns)
- All table names and column names must use **snake_case**.
  - Example: `jersey_preferences`, `jersey_id`, `created_at`

## SQL Written Inside TypeScript Files

- Never use table aliases in SQL queries. Always write out the full table name, even in joins with multiple tables.
- This keeps queries readable and avoids the need to trace back what a short alias (e.g. `jp`, `j`) refers to, especially in complex queries with many joins.

**Do this:**
```sql
SELECT * FROM jersey_preferences
JOIN jerseys ON jersey_preferences.jersey_id = jerseys.id
```

**Not this:**
```sql
SELECT * FROM jersey_preferences jp
JOIN jerseys j ON jp.jersey_id = j.id
```

This applies to all clauses (SELECT, JOIN, WHERE, ORDER BY, etc.) — always reference columns using the full table name, not an alias.