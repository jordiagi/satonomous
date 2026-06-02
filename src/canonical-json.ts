import { createHash } from 'node:crypto';

function isUnsupportedJsonValue(value: unknown): boolean {
  return value === undefined || typeof value === 'function' || typeof value === 'symbol';
}

/**
 * Minimal JSON Canonicalization Scheme style serializer for Satonomous hash
 * inputs: no whitespace, deterministic key ordering, and no non-JSON values.
 */
export function canonicalJsonStringify(value: unknown): string {
  if (value === null) return 'null';

  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError('Canonical JSON cannot encode non-finite numbers');
    }
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (typeof value === 'bigint') {
    throw new TypeError('Canonical JSON cannot encode bigint values');
  }
  if (isUnsupportedJsonValue(value)) {
    throw new TypeError('Canonical JSON cannot encode undefined, function, or symbol values');
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => {
      if (isUnsupportedJsonValue(entry)) {
        throw new TypeError('Canonical JSON arrays cannot contain undefined, function, or symbol values');
      }
      return canonicalJsonStringify(entry);
    }).join(',')}]`;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new TypeError('Canonical JSON can only encode plain objects');
  }

  const record = value as Record<string, unknown>;
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => {
      const entry = record[key];
      if (typeof entry === 'function' || typeof entry === 'symbol') {
        throw new TypeError('Canonical JSON objects cannot contain function or symbol values');
      }
      return `${JSON.stringify(key)}:${canonicalJsonStringify(entry)}`;
    });

  return `{${entries.join(',')}}`;
}

export function sha256Canonical(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJsonStringify(value)).digest('hex')}`;
}
