import { describe, it, expect, beforeEach } from 'vitest';
import { L402Agent, L402Error } from '../client.js';

describe('L402Agent', () => {
  it('requires apiKey in constructor', () => {
    expect(() => {
      new L402Agent({ apiKey: '' });
    }).toThrow('apiKey is required');
  });

  it('creates instance with valid apiKey', () => {
    const agent = new L402Agent({ apiKey: 'test-key' });
    expect(agent).toBeDefined();
  });

  it('uses default API URL', () => {
    const agent = new L402Agent({ apiKey: 'test-key' });
    expect(agent).toBeDefined();
  });

  it('uses custom API URL', () => {
    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://custom.example.com' });
    expect(agent).toBeDefined();
  });

  it('register is a static method', async () => {
    expect(typeof L402Agent.register).toBe('function');
  });

  it('L402Error has correct properties', () => {
    const err = new L402Error('Test error', 400, 'TEST_CODE');
    expect(err.message).toBe('Test error');
    expect(err.status).toBe(400);
    expect(err.code).toBe('TEST_CODE');
    expect(err.name).toBe('L402Error');
  });
});
