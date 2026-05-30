import { afterEach, describe, it, expect, vi } from 'vitest';
import { L402Agent, L402Error } from '../client.js';
import { createContractReceipt, verifyContractReceipt } from '../receipts.js';
import { createServiceCard, verifyServiceCard } from '../service-cards.js';
import { createTokenServiceCard, verifyTokenServiceCard } from '../token-service-cards.js';
import { createWalletPolicy, evaluateWalletPolicy, verifyWalletPolicy } from '../wallet-policies.js';
import { getContractNextAction } from '../contract-actions.js';
import type { Contract, CreateTokenServiceCardOptions, LedgerEntry, Offer } from '../types.js';

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

  it('creates and verifies deterministic service cards', () => {
    const offer: Offer = {
      id: 'offer-1',
      seller_tenant_id: 'seller-1',
      service_type: 'code_review',
      title: 'Review TypeScript PR',
      description: 'Review one pull request',
      terms: {
        sla_minutes: 60,
        dispute_window_minutes: 120,
        proof_requirements: ['GitHub review URL', 'summary hash'],
      },
      price_sats: 5000,
      max_concurrent_contracts: 2,
      active: 1,
      created_at: '2026-05-29T10:00:00Z',
      expires_at: null,
      seller_reputation: {
        score: 82,
        level: 'gold',
        completed_contracts: 10,
        settled_contracts: 9,
        dispute_rate: 0.1,
        total_volume_sats: 50_000,
        unique_counterparties: 7,
      },
    };

    const card = createServiceCard(offer, null, { issuedAt: '2026-05-29T10:01:00Z' });
    const sameCard = createServiceCard(offer, null, { issuedAt: '2026-05-29T10:01:00Z' });

    expect(card.card_id).toBe(sameCard.card_id);
    expect(card.body_hash).toMatch(/^sha256:/);
    expect(card.service.price_sats).toBe(5000);
    expect(card.terms.proof_requirements).toEqual(['GitHub review URL', 'summary hash']);
    expect(card.accept.accept_url).toBe('satonomous://offers/offer-1/accept');
    expect(verifyServiceCard(card)).toMatchObject({
      valid: true,
      codes: ['valid'],
      warnings: [],
    });
  });

  it('flags mutated service cards', () => {
    const card = createServiceCard({
      id: 'offer-2',
      seller_tenant_id: 'seller-1',
      service_type: 'research',
      title: 'Summarize article',
      description: null,
      terms: {},
      price_sats: 100,
      max_concurrent_contracts: 1,
      active: 1,
      created_at: '2026-05-29T10:00:00Z',
      expires_at: null,
    }, null, { issuedAt: '2026-05-29T10:01:00Z' });
    card.service.price_sats = 101;
    card.terms.sla_minutes = null;

    const result = verifyServiceCard(card);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain('body_hash_mismatch');
    expect(result.warnings).toContain('missing_sla');
  });

  it('fetches a generated service card from offer and reputation data', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'offer-3',
          seller_tenant_id: 'seller-1',
          service_type: 'research',
          title: 'Summarize article',
          description: null,
          terms: { sla_minutes: 30, dispute_window_minutes: 60 },
          price_sats: 25,
          max_concurrent_contracts: 1,
          active: 1,
          created_at: '2026-05-29T10:00:00Z',
          expires_at: null,
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          tenant_id: 'seller-1',
          seller: {
            score: 90,
            level: 'platinum',
            summary: {
              settled_contracts: 20,
              dispute_rate: 0,
              total_volume_sats: 100_000,
              unique_counterparties: 15,
            },
          },
          buyer: { score: 70, level: 'silver', summary: {} },
        }),
      } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    const card = await agent.getServiceCard('offer-3', { issuedAt: '2026-05-29T10:01:00Z' });

    expect(card.service.offer_id).toBe('offer-3');
    expect(card.seller.reputation?.score).toBe(90);
    expect(card.accept.contract_template_ref).toBe('satonomous:offer:offer-3');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/offers/offer-3');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/v1/reputation/seller-1');
  });

  it('creates and verifies deterministic token service cards', () => {
    const options: CreateTokenServiceCardOptions = {
      issuedAt: '2026-05-30T22:00:00.000Z',
      seller: {
        agent_id: 'seller_agent_123',
        payout: { lightning_address: 'seller@example.com' },
        reputation: {
          score: 82,
          level: 'gold',
          settled_contracts: 9,
          dispute_rate: 0.1,
          total_volume_sats: 50_000,
          unique_counterparties: 7,
        },
        trust: { tier: 'verified', policy_flags: [] },
      },
      service: {
        service_type: 'llm_inference',
        title: 'Discounted coding-model inference',
        description: 'OpenAI-compatible chat completions served through prepaid Satonomous escrow.',
        active: true,
        created_at: '2026-05-30T22:00:00.000Z',
        expires_at: null,
      },
      inference: {
        api: 'openai-compatible',
        endpoint: 'https://seller.example.com/v1',
        models: [
          {
            id: 'seller/coding-large',
            display_name: 'Coding Large',
            max_context_tokens: 128_000,
            max_output_tokens: 8192,
            modalities: ['text', 'tool_call'],
          },
        ],
        supports: {
          chat_completions: true,
          streaming: true,
          tools: true,
          json_mode: true,
        },
        provider: {
          type: 'hosted',
          name: 'seller-operated gateway',
          disclosure: 'class',
          authorization_basis: 'authorized_resale',
          seller_attests_authorized: true,
          attestation:
            'Seller attests it is authorized to provide this inference service and is not sharing raw provider credentials.',
        },
      },
      pricing: {
        currency: 'sats',
        unit: 'per_1k_tokens',
        input_sats: 2,
        output_sats: 8,
        request_minimum_sats: 1,
        minimum_contract_sats: 100,
        max_contract_sats: 10_000,
        quote_ttl_seconds: 60,
        discount: {
          reference_provider: 'public-retail',
          min_discount_pct: 50,
        },
      },
      limits: {
        max_context_tokens: 128_000,
        max_output_tokens: 8192,
        max_requests_per_contract: 50,
        max_requests_per_minute: 6,
        max_concurrent_requests: 2,
        expires_after_minutes: 120,
      },
      metering: {
        method: 'gateway_verified',
        token_counter: 'gateway',
        dry_run_quote: true,
      },
      privacy: {
        retention: 'hash_only',
        log_prompts: false,
        log_completions: false,
        training_use: false,
        public_receipts: 'hash_only',
      },
      settlement: {
        dispute_window_minutes: 120,
        refund_unused_sats: true,
        partial_settlement: true,
      },
      accept: {
        accept_url: 'satonomous://token-services/seller-coding-large/accept',
        contract_template_ref: 'satonomous:token-service:seller-coding-large',
      },
      links: {
        docs: 'https://github.com/jordiagi/satonomous/blob/main/TOKEN_SERVICE_CARDS.md',
        quickstart: 'https://github.com/jordiagi/satonomous-mcp',
      },
    };

    const card = createTokenServiceCard(options);
    const sameCard = createTokenServiceCard(options);

    expect(card.card_id).toBe(sameCard.card_id);
    expect(card.card_id).toMatch(/^tsc_/);
    expect(card.body_hash).toMatch(/^sha256:/);
    expect(card.inference.models[0].id).toBe('seller/coding-large');
    expect(card.pricing.max_contract_sats).toBe(10_000);
    expect(card.metering.usage_receipt_schema).toBe('satonomous.token-usage-receipt/v0');
    expect(card.metering.idempotency).toBe('request_id');
    expect(verifyTokenServiceCard(card)).toMatchObject({
      valid: true,
      codes: ['valid'],
      warnings: [],
    });
  });

  it('rejects unsafe token service cards', () => {
    const card = createTokenServiceCard({
      issuedAt: '2026-05-30T22:00:00.000Z',
      seller: {
        agent_id: 'seller_agent_123',
        reputation: null,
        trust: { tier: 'anonymous', policy_flags: ['raw_api_key_resale'] },
      },
      service: {
        service_type: 'llm_inference',
        title: 'Cheap tokens',
        description: null,
        active: true,
        created_at: '2026-05-30T22:00:00.000Z',
        expires_at: null,
      },
      inference: {
        api: 'openai-compatible',
        models: [],
        provider: {
          type: 'unknown',
          disclosure: 'undisclosed',
          authorization_basis: 'prohibited_risk',
          seller_attests_authorized: false,
        },
      },
      pricing: {
        currency: 'sats',
        unit: 'per_1k_tokens',
        input_sats: 0,
        output_sats: 0,
        max_contract_sats: 0,
      },
      limits: {
        max_context_tokens: 0,
        max_output_tokens: 0,
      },
      metering: {
        method: 'seller_signed_usage',
        token_counter: 'custom',
        dry_run_quote: false,
      },
      privacy: {
        retention: 'full',
        log_prompts: true,
        log_completions: true,
        training_use: true,
        public_receipts: 'private',
      },
      settlement: {
        dispute_window_minutes: 0,
        refund_unused_sats: false,
        partial_settlement: false,
      },
      accept: {
        accept_url: '',
        contract_template_ref: 'satonomous:token-service:unsafe',
      },
    });

    const result = verifyTokenServiceCard(card);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain('missing_model');
    expect(result.codes).toContain('invalid_price');
    expect(result.codes).toContain('missing_budget_cap');
    expect(result.codes).toContain('missing_accept_url');
    expect(result.codes).toContain('missing_authorization_attestation');
    expect(result.codes).toContain('prohibited_resale_risk');
    expect(result.codes).toContain('raw_credential_resale');
    expect(result.warnings).toContain('undisclosed_provider');
    expect(result.warnings).toContain('missing_reputation');
    expect(result.warnings).toContain('prompt_logging_enabled');
  });

  it('creates and evaluates deterministic wallet policies', () => {
    const policy = createWalletPolicy({
      issuedAt: '2026-05-30T10:00:00Z',
      limits: {
        max_contract_price_sats: 1_000,
        max_contract_total_sats: 1_100,
        daily_spend_limit_sats: 2_000,
        min_seller_reputation: 70,
      },
      approvals: {
        ask_human_above_sats: 750,
        ask_human_for_unrated_counterparty: true,
      },
      allowlists: {
        service_types: ['code_review'],
      },
    });
    const samePolicy = createWalletPolicy({
      issuedAt: '2026-05-30T10:00:00Z',
      limits: {
        max_contract_price_sats: 1_000,
        max_contract_total_sats: 1_100,
        daily_spend_limit_sats: 2_000,
        min_seller_reputation: 70,
      },
      approvals: {
        ask_human_above_sats: 750,
        ask_human_for_unrated_counterparty: true,
      },
      allowlists: {
        service_types: ['code_review'],
      },
    });

    expect(policy.policy_id).toBe(samePolicy.policy_id);
    expect(policy.body_hash).toMatch(/^sha256:/);
    expect(verifyWalletPolicy(policy)).toMatchObject({
      valid: true,
      codes: ['valid'],
    });

    const ask = evaluateWalletPolicy(
      policy,
      {
        amount_sats: 900,
        price_sats: 850,
        fee_sats: 50,
        counterparty_tenant_id: 'seller-1',
        service_type: 'code_review',
      },
      {
        daily_spent_sats: 100,
        seller_reputation_score: 90,
      }
    );
    expect(ask.decision).toBe('ask_human');
    expect(ask.codes).toContain('ask_human_amount_above_threshold');

    const denied = evaluateWalletPolicy(
      policy,
      {
        amount_sats: 1_200,
        price_sats: 1_150,
        fee_sats: 50,
        counterparty_tenant_id: 'seller-1',
        service_type: 'research',
      },
      {
        daily_spent_sats: 1_000,
        seller_reputation_score: 60,
      }
    );
    expect(denied.decision).toBe('deny');
    expect(denied.codes).toContain('deny_amount_exceeds_contract_price_limit');
    expect(denied.codes).toContain('deny_service_type_not_allowed');
    expect(denied.codes).toContain('deny_min_seller_reputation');
  });

  it('enforces wallet policy before funding a contract', async () => {
    const policy = createWalletPolicy({
      issuedAt: '2026-05-30T10:00:00Z',
      limits: {
        max_contract_total_sats: 100,
      },
    });

    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'contract-policy-1',
        offer_id: 'offer-policy-1',
        buyer_tenant_id: 'buyer-1',
        seller_tenant_id: 'seller-1',
        terms_snapshot: { title: 'Large job', service_type: 'research' },
        price_sats: 150,
        fee_sats: 1,
        status: 'accepted',
        delivery_proof: {},
        dispute_reason: null,
        accepted_at: '2026-05-30T10:00:00Z',
        funded_at: null,
        completed_at: null,
        released_at: null,
        disputed_at: null,
        created_at: '2026-05-30T10:00:00Z',
      }),
    } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com', walletPolicy: policy });
    await expect(agent.fundContract('contract-policy-1')).rejects.toMatchObject({
      code: 'WALLET_POLICY_DENIED',
    });
  });

  it('requires approval for wallet policy ask-human decisions', async () => {
    const policy = createWalletPolicy({
      issuedAt: '2026-05-30T10:00:00Z',
      approvals: {
        ask_human_above_sats: 100,
      },
    });
    const contract = {
      id: 'contract-policy-2',
      offer_id: 'offer-policy-2',
      buyer_tenant_id: 'buyer-1',
      seller_tenant_id: 'seller-1',
      terms_snapshot: { title: 'Medium job', service_type: 'research' },
      price_sats: 150,
      fee_sats: 1,
      status: 'accepted',
      delivery_proof: {},
      dispute_reason: null,
      accepted_at: '2026-05-30T10:00:00Z',
      funded_at: null,
      completed_at: null,
      released_at: null,
      disputed_at: null,
      created_at: '2026-05-30T10:00:00Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => contract,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          contract: { ...contract, status: 'funded' },
          message: 'funded',
        }),
      } as Response);

    const agent = new L402Agent({
      apiKey: 'test-key',
      apiUrl: 'https://api.example.com',
      walletPolicy: policy,
      onPolicyApprovalNeeded: () => true,
    });
    const result = await agent.fundContract('contract-policy-2');

    expect(result.contract.status).toBe('funded');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/contracts/contract-policy-2');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/v1/contracts/contract-policy-2/fund');
  });

  it('classifies next contract actions by role and status', () => {
    const funded: Contract = {
      id: 'contract-loop-1',
      offer_id: 'offer-loop-1',
      buyer_tenant_id: 'buyer-1',
      seller_tenant_id: 'seller-1',
      terms_snapshot: { title: 'Review PR', service_type: 'code_review', sla_minutes: 30 },
      price_sats: 500,
      fee_sats: 5,
      status: 'funded',
      delivery_proof: {},
      dispute_reason: null,
      accepted_at: '2026-05-30T10:00:00Z',
      funded_at: '2026-05-30T10:05:00Z',
      completed_at: null,
      released_at: null,
      disputed_at: null,
      created_at: '2026-05-30T10:00:00Z',
    };

    const sellerAction = getContractNextAction(funded, {
      role: 'seller',
      now: '2026-05-30T10:10:00Z',
    });
    expect(sellerAction).toMatchObject({
      action: 'submit_delivery',
      actor: 'seller',
      required: true,
      due_at: '2026-05-30T10:35:00.000Z',
      overdue: false,
    });

    const buyerAction = getContractNextAction(funded, {
      role: 'buyer',
      now: '2026-05-30T10:40:00Z',
    });
    expect(buyerAction).toMatchObject({
      action: 'wait_for_delivery',
      actor: 'seller',
      required: false,
      overdue: true,
    });
  });

  it('lists and waits for contract actions from gateway state', async () => {
    const accepted = {
      id: 'contract-loop-2',
      offer_id: 'offer-loop-2',
      buyer_tenant_id: 'buyer-1',
      seller_tenant_id: 'seller-1',
      terms_snapshot: { title: 'Research', service_type: 'research' },
      price_sats: 25,
      fee_sats: 1,
      status: 'accepted',
      delivery_proof: {},
      dispute_reason: null,
      accepted_at: '2026-05-30T10:00:00Z',
      funded_at: null,
      completed_at: null,
      released_at: null,
      disputed_at: null,
      created_at: '2026-05-30T10:00:00Z',
    };
    const completed = {
      ...accepted,
      status: 'completed',
      completed_at: '2026-05-30T10:30:00Z',
    };
    const fetchMock = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ contracts: [accepted] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => accepted,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => completed,
      } as Response);

    const agent = new L402Agent({ apiKey: 'test-key', apiUrl: 'https://api.example.com' });
    const actions = await agent.listContractActions(undefined, { role: 'buyer' });
    expect(actions[0]).toMatchObject({
      action: 'fund_contract',
      required: true,
    });

    const next = await agent.waitForContractAction('contract-loop-2', {
      role: 'buyer',
      action: 'confirm_or_dispute_delivery',
      pollIntervalMs: 1,
      timeoutMs: 100,
    });
    expect(next.status).toBe('completed');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.example.com/api/v1/contracts');
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.example.com/api/v1/contracts/contract-loop-2');
    expect(fetchMock.mock.calls[2][0]).toBe('https://api.example.com/api/v1/contracts/contract-loop-2');
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
