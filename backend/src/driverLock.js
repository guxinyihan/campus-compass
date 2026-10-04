// Serialize role/assignment changes in the single Node process used by v1.
// Multi-instance administration requires Mongo transactions and a replica set.
const pending = new Map();
export async function withDriverLock(id, operation) {
  if (!id) return operation();
  const key = String(id).toLowerCase();
  const previous = pending.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  pending.set(key, current);
  try { return await current; }
  finally { if (pending.get(key) === current) pending.delete(key); }
}
