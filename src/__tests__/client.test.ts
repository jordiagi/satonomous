import { afterEach, describe, it, expect, vi } from 'vitest';
import { L402Agent, L402Error } from '../client.js';
import { createContractReceipt, verifyContractReceipt } from '../receipts.js';
import type { Contract, LedgerEntry } from '../types.js';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('lists offers with reputation filters', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ offers: [] }),
    } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    await agent.listOffers({ sort: 'reputation', min_reputation: 75, hide_unrated: true, limit: 10 });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.com/api/v1/offers?sort=reputation&min_reputation=75&hide_unrated=true&limit=10',
      expect.objectContaining({
        headers: expect.objectContaining({ 'X-L402-Key': 'test-key' }),
      })
    );
  });

  it('browses marketplace offers without tenant auth', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ offers: [] }),
    } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    await agent.browseOffers({ sort: 'reputation' });

    const [, init] = fetchMock.mock.calls[0];
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/offers?sort=reputation');
    expect((init?.headers as Record<string, string>)['X-L402-Key']).toBeUndefined();
  });

  it('gets current tenant reputation when tenantId is omitted', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ tenant_id: 'tenant-1' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tenant_id: 'tenant-1',
          seller: { score: 80, level: 'gold', summary: {}, last_updated_at: 'now' },
          buyer: { score: 70, level: 'silver', summary: {}, last_updated_at: 'now' },
        }),
      } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    const reputation = await agent.getReputation();

    expect(reputation.tenant_id).toBe('tenant-1');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/tenants/me');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/v1/reputation/tenant-1');
  });

  it('creates and verifies deterministic contract receipts', () => {
    const contract: Contract = {
      id: 'contract-1',
      offer_id: 'offer-1',
      buyer_tenant_id: 'buyer-1',
      seller_tenant_id: 'seller-1',
      terms_snapshot: {
        title: 'Review TypeScript PR',
        description: 'Review one pull request',
        service_type: 'code_review',
        sla_minutes: 60,
        dispute_window_minutes: 120,
      },
      price_sats: 5000,
      fee_sats: 50,
      status: 'released',
      delivery_proof: {
        proof_url: 'https://example.com/review',
        payload_hash: 'sha256:delivery',
      },
      dispute_reason: null,
      accepted_at: '2026-05-29T10:00:00Z',
      funded_at: '2026-05-29T10:01:00Z',
      completed_at: '2026-05-29T10:20:00Z',
      released_at: '2026-05-29T10:25:00Z',
      disputed_at: null,
      created_at: '2026-05-29T09:59:00Z',
    };
    const ledger: LedgerEntry[] = [{
      id: 1,
      type: 'debit',
      amount_sats: 5050,
      source: 'contract_release',
      reference_id: 'contract-1',
      balance_after: 10_000,
      created_at: '2026-05-29T10:25:00Z',
    }];

    const receipt = createContractReceipt(contract, ledger);
    const sameReceipt = createContractReceipt(contract, ledger);

    expect(receipt.receipt_id).toBe(sameReceipt.receipt_id);
    expect(receipt.body_hash).toMatch(/^sha256:/);
    expect(receipt.settlement.outcome).toBe('released');
    expect(receipt.evidence_refs[0]?.kind).toBe('delivery');
    expect(verifyContractReceipt(receipt)).toMatchObject({
      valid: true,
      codes: ['valid'],
      warnings: [],
    });
  });

  it('flags mutated contract receipts', () => {
    const receipt = createContractReceipt({
      id: 'contract-2',
      offer_id: 'offer-2',
      buyer_tenant_id: 'buyer-1',
      seller_tenant_id: 'seller-1',
      terms_snapshot: {},
      price_sats: 100,
      fee_sats: 1,
      status: 'released',
      delivery_proof: {},
      dispute_reason: null,
      accepted_at: '2026-05-29T10:00:00Z',
      funded_at: null,
      completed_at: null,
      released_at: '2026-05-29T10:01:00Z',
      disputed_at: null,
      created_at: '2026-05-29T10:00:00Z',
    }, []);
    receipt.contract.price_sats = 101;

    const result = verifyContractReceipt(receipt);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain('body_hash_mismatch');
    expect(result.warnings).toContain('missing_delivery_proof');
  });

  it('fetches a generated receipt from contract and ledger data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'contract-3',
          offer_id: 'offer-3',
          buyer_tenant_id: 'buyer-1',
          seller_tenant_id: 'seller-1',
          terms_snapshot: { title: 'Summarize article', service_type: 'research' },
          price_sats: 25,
          fee_sats: 1,
          status: 'released',
          delivery_proof: { url: 'https://example.com/summary' },
          dispute_reason: null,
          accepted_at: '2026-05-29T10:00:00Z',
          funded_at: '2026-05-29T10:01:00Z',
          completed_at: '2026-05-29T10:05:00Z',
          released_at: '2026-05-29T10:06:00Z',
          disputed_at: null,
          created_at: '2026-05-29T10:00:00Z',
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          balance_sats: 1000,
          entries: [{
            id: 1,
            type: 'debit',
            amount_sats: 26,
            source: 'contract_release',
            reference_id: 'contract-3',
            balance_after: 974,
            created_at: '2026-05-29T10:06:00Z',
          }],
        }),
      } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    const receipt = await agent.getContractReceipt('contract-3');

    expect(receipt.contract.id).toBe('contract-3');
    expect(receipt.settlement.ledger_reference_ids).toEqual(['contract-3']);
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/contracts/contract-3');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/v1/ledger?limit=100');
  });
});
