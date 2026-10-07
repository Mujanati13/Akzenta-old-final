# Fix PostgreSQL Sequences

This directory contains tools to automatically fix all PostgreSQL sequences that are out of sync with their table data.

## Problem

When sequences get out of sync (usually after manual data imports or direct SQL inserts), you'll see errors like:
```
QueryFailedError: duplicate key value violates unique constraint "PK_..."
Key (id)=(2) already exists.
```

## Solutions

### Option 1: SQL Script (Recommended for Quick Fix)

Run the SQL script directly:

```bash
# Using psql
psql -U your_username -d your_database_name -f fix_all_sequences.sql

# Or if using Docker
docker exec -i your_postgres_container psql -U your_username -d your_database_name < fix_all_sequences.sql
```

This script automatically:
- Finds all sequences in the `public` schema
- Matches them to their corresponding tables
- Checks if sequences are out of sync
- Fixes any sequences that are behind

### What it does:
- ✅ Only fixes sequences that are actually out of sync
- ✅ Shows detailed output for each sequence
- ✅ Safe to run multiple times
- ✅ No manual table names needed

### Output Example:
```
NOTICE:  ✅ FIXED: client_company_id_seq (table: client_company, column: id, max_id: 5, was: 2)
NOTICE:  ✓ OK: merchandiser_id_seq (table: merchandiser, current: 10, max_id: 8)
NOTICE:  Sequence fix complete!
NOTICE:  Fixed: 1 sequences
NOTICE:  OK: 15 sequences
```

---

### Option 2: TypeScript Script (For Programmatic Use)

Run the TypeScript script:

```bash
cd Backend
npm run fix:sequences
```

This uses the same logic as the SQL script but runs through TypeORM.

**Requirements:**
- Make sure your `.env` file has correct database credentials
- The script will connect using the same config as your app

---

### Option 3: Use the Utility Function in Code

You can also use the utility function programmatically:

```typescript
import { AppDataSource } from './database/data-source';
import { fixAllSequences } from './utils/fix-sequences.util';

// Initialize and run
await AppDataSource.initialize();
await fixAllSequences(AppDataSource);
await AppDataSource.destroy();
```

---

## When to Run

Run this script when:
- ✅ You see primary key violation errors
- ✅ After importing data manually
- ✅ After restoring from a backup
- ✅ When sequences seem out of sync
- ✅ As a preventive measure (safe to run anytime)

## Safety

- ✅ **Read-only operations** on data (only reads MAX(id))
- ✅ **Only modifies sequences** (never touches table data)
- ✅ **Safe to run multiple times**
- ✅ **No data loss risk**

## Troubleshooting

### "relation does not exist"
- Make sure you're connected to the correct database
- Check that tables exist in the `public` schema

### "permission denied"
- Ensure your database user has permissions to:
  - Read from `pg_sequences` and `information_schema`
  - Execute `setval()` on sequences

### Script finds no sequences
- Check that sequences follow the `*_id_seq` naming pattern
- Verify you're in the `public` schema

---

## Files

- `fix_all_sequences.sql` - SQL script (Option 1)
- `scripts/fix-sequences.ts` - TypeScript script (Option 2)
- `src/utils/fix-sequences.util.ts` - Utility function (Option 3)

---

## Quick Reference

```bash
# Quick SQL fix
psql -U postgres -d your_db -f fix_all_sequences.sql

# Quick TypeScript fix
npm run fix:sequences
```

