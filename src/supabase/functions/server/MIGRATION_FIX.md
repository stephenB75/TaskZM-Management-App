# KV Store JSON Parsing Fix

## Problem

The server was double-parsing JSON data:
1. Storing data with `JSON.stringify(data)`
2. Retrieving and parsing with `JSON.parse(data)`

Since Postgres JSONB already handles JSON natively, this caused the error:
`SyntaxError: "undefined" is not valid JSON`

## Solution

1. Store objects directly (no JSON.stringify)
2. Retrieve objects directly (no JSON.parse)
3. Handle undefined/null values safely

## Changes Required

Replace all instances of:
```typescript
// OLD - Wrong
await kv.set(key, JSON.stringify(value));
const data = await kv.get(key);
const parsed = JSON.parse(data);
```

With:
```typescript
// NEW - Correct
await kv.set(key, value);
const data = await kv.get(key);
// data is already the object
```

## Fixed in index.tsx

All these patterns have been corrected:
- Workspace members storage/retrieval
- Task storage/retrieval
- Activity logging
- Project storage
- Settings storage
- Time tracking storage
- Subscription storage
