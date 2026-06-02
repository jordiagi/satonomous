import { describe, expect, it } from 'vitest';
import { canonicalJsonStringify, sha256Canonical } from '../canonical-json.js';

describe('canonical JSON hashing', () => {
  it('serializes objects with deterministic nested key ordering', () => {
    expect(
      canonicalJsonStringify({
        z: 1,
        a: { y: true, x: 'x' },
        m: [3, { b: null, a: 2 }],
      })
    ).toBe('{"a":{"x":"x","y":true},"m":[3,{"a":2,"b":null}],"z":1}');
  });

  it('omits undefined object properties but rejects non-JSON array values', () => {
    expect(canonicalJsonStringify({ a: 1, b: undefined })).toBe('{"a":1}');
    expect(() => canonicalJsonStringify([undefined])).toThrow(TypeError);
  });

  it('rejects values that JSON.stringify would encode ambiguously', () => {
    expect(() => canonicalJsonStringify({ value: Number.NaN })).toThrow(TypeError);
    expect(() => canonicalJsonStringify({ value: Number.POSITIVE_INFINITY })).toThrow(TypeError);
    expect(() => canonicalJsonStringify({ value: 1n })).toThrow(TypeError);
    expect(() => canonicalJsonStringify({ value: new Date('2026-06-01T00:00:00Z') })).toThrow(TypeError);
  });

  it('hashes the canonical representation', () => {
    expect(sha256Canonical({ b: 2, a: 1 })).toBe(
      'sha256:43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777'
    );
  });
});
