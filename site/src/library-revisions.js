export const clone = value => JSON.parse(JSON.stringify(value));
export const validId = value => typeof value === 'string' && value.length > 0 && value.length <= 512;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value));
const canonical = value => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);

export function libraryId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(value => value.toString(16).padStart(2,'0')).join('');
  return [hex.slice(0,8),hex.slice(8,12),hex.slice(12,16),hex.slice(16,20),hex.slice(20)].join('-');
}
export function revisionMetadata() {
  return { revision: libraryId(), ancestors: [], updatedAt: new Date().toISOString(), deletedAt: null };
}
export function reviseRecord(record, changes, fields) {
  const next = { ...record, ...changes };
  if (fields.every(key => JSON.stringify(next[key]) === JSON.stringify(record[key]))) return record;
  return { ...next, id: record.id, revision: libraryId(), ancestors: [record.revision, ...record.ancestors].slice(0,100), updatedAt: new Date().toISOString() };
}
export function validateRevision(record) {
  if (!validId(record.id) || !validId(record.revision) || !Array.isArray(record.ancestors) || record.ancestors.length > 100 || !record.ancestors.every(validId)
    || new Set([record.revision,...record.ancestors]).size !== record.ancestors.length + 1 || !timestamp(record.updatedAt)
    || (record.deletedAt !== null && !timestamp(record.deletedAt))
    || (record.conflictOf !== undefined && !validId(record.conflictOf)) || (record.forkRevision !== undefined && !validId(record.forkRevision))) throw new RangeError('Invalid record revision');
}

// Whole-record ancestry merge. Both record kinds retain independent conflicts.
export function mergeRecords(local, incoming, makeFork) {
  const records = clone(local), report = { added: 0, updated: 0, conflicts: 0 };
  for (const remote of incoming) {
    const index = records.findIndex(record => record.id === remote.id);
    if (index < 0) { records.push(clone(remote)); report.added++; continue; }
    const current = records[index];
    if (current.revision === remote.revision) {
      if (canonical(current) !== canonical(remote)) throw new RangeError('Revision payload mismatch');
      continue;
    }
    if (current.ancestors.includes(remote.revision)) continue;
    if (remote.ancestors.includes(current.revision)) { records[index] = clone(remote); report.updated++; continue; }
    if (records.some(record => record.conflictOf === remote.id && record.forkRevision === remote.revision)) continue;
    records.push({ ...makeFork(remote), deletedAt: remote.deletedAt, conflictOf: remote.id, forkRevision: remote.revision });
    report.conflicts++;
  }
  return { records, ...report };
}
