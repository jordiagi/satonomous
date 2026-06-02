import { verify } from 'node:crypto';
import { canonicalJsonStringify, sha256Canonical } from './canonical-json.js';
import type {
  CreateMeteredEscrowContractOptions,
  MeteredEscrowContract,
  MeteredEscrowContractStatus,
  MeteredEscrowVerificationCode,
  MeteredEscrowVerificationResult,
  MeteredUsageApplyResult,
  MeteredUsageEvent,
  MeteredUsageInput,
  MeteredUsageQuote,
  TokenServiceCard,
} from './types.js';

const METERED_ESCROW_SCHEMA = 'satonomous.metered-escrow-contract/v0' as const;
const USAGE_EVENT_SCHEMA = 'satonomous.token-usage-event/v0' as const;
const SPENDABLE_STATUSES = new Set<MeteredEscrowContractStatus>(['funded', 'active']);
const TERMINAL_STATUSES = new Set<MeteredEscrowContractStatus>(['exhausted', 'completed', 'refunded', 'resolved', 'expired']);
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function safeBigInt(value: number | undefined, field: string, fallback = 0): bigint {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 0) {
    throw new RangeError(`${field} must be a non-negative safe integer`);
  }
  return BigInt(resolved);
}

function safeNumber(value: bigint, field: string): number {
  if (value > MAX_SAFE_BIGINT || value < -MAX_SAFE_BIGINT) {
    throw new RangeError(`${field} exceeds Number.MAX_SAFE_INTEGER`);
  }
  return Number(value);
}

function checkedBigInt(value: unknown): bigint | null {
  return nonNegativeInteger(value) ? BigInt(value) : null;
}

function tokenCountSum(inputTokens: unknown, outputTokens: unknown, cachedInputTokens: unknown = 0): bigint | null {
  const input = checkedBigInt(inputTokens);
  const output = checkedBigInt(outputTokens);
  const cached = checkedBigInt(cachedInputTokens);
  return input === null || output === null || cached === null ? null : input + output + cached;
}

function ceilingDiv(numerator: bigint, denominator: bigint): bigint {
  return numerator === 0n ? 0n : (numerator + denominator - 1n) / denominator;
}

function pricingDenominator(unit: TokenServiceCard['pricing']['unit']): bigint {
  return unit === 'per_1m_tokens' ? 1_000_000n : 1_000n;
}

function contractTermsBody(contract: MeteredEscrowContract): unknown {
  return {
    schema: contract.schema,
    issued_at: contract.issued_at,
    token_service_card_id: contract.token_service_card_id,
    token_service_card_hash: contract.token_service_card_hash,
    buyer_agent_id: contract.buyer_agent_id,
    seller_agent_id: contract.seller_agent_id,
    pricing: contract.pricing,
    limits: contract.limits,
    metering: contract.metering,
    settlement: contract.settlement,
    escrowed_sats: contract.escrow.escrowed_sats,
    links: contract.links,
  };
}

function contractBody(contract: MeteredEscrowContract): Omit<MeteredEscrowContract, 'contract_id' | 'terms_hash' | 'body_hash'> {
  const { contract_id: _contractId, terms_hash: _termsHash, body_hash: _bodyHash, ...body } = contract;
  return body;
}

function usageEventBody(event: MeteredUsageEvent): Omit<MeteredUsageEvent, 'event_id'> {
  const { event_id: _eventId, ...body } = event;
  return body;
}

function completeUsageEvent(event: MeteredUsageEvent): MeteredUsageEvent {
  const eventHash = sha256Canonical(usageEventBody(event));
  return {
    ...event,
    event_id: `tue_${eventHash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
  };
}

export function createMeteredUsageSignaturePayload(
  contract: MeteredEscrowContract,
  usage: MeteredUsageInput | MeteredUsageEvent,
  quoteOrSatsCharged: MeteredUsageQuote | number
): string {
  const sats_charged = typeof quoteOrSatsCharged === 'number' ? quoteOrSatsCharged : quoteOrSatsCharged.total_sats;
  const isInput = 'requestId' in usage;
  const input_tokens = isInput ? usage.inputTokens : usage.input_tokens;
  const output_tokens = isInput ? usage.outputTokens : usage.output_tokens;
  const cached_input_tokens = isInput ? usage.cachedInputTokens : usage.cached_input_tokens;
  const request_id = isInput ? usage.requestId : usage.request_id;
  const model_id = isInput ? usage.modelId : usage.model_id;
  const metering_source = isInput ? usage.meteringSource ?? contract.metering.method : usage.metering_source;
  const prompt_hash = isInput ? usage.promptHash : usage.prompt_hash;
  const completion_hash = isInput ? usage.completionHash : usage.completion_hash;
  const metadata_hash = isInput ? usage.metadataHash : usage.metadata_hash;

  return canonicalJsonStringify({
    schema: USAGE_EVENT_SCHEMA,
    contract_id: contract.contract_id,
    token_service_card_hash: contract.token_service_card_hash,
    seller_agent_id: contract.seller_agent_id,
    buyer_agent_id: contract.buyer_agent_id,
    request_id,
    model_id,
    input_tokens,
    output_tokens,
    cached_input_tokens,
    sats_charged,
    metering_source,
    prompt_hash,
    completion_hash,
    metadata_hash,
  });
}

function verifyMeteredUsageSignature(payload: string, signature: string, publicKeyPem: string): boolean {
  try {
    return verify(null, Buffer.from(payload), publicKeyPem, Buffer.from(signature, 'base64'));
  } catch {
    return false;
  }
}

function completeContract(contract: MeteredEscrowContract): MeteredEscrowContract {
  const terms_hash = sha256Canonical(contractTermsBody(contract));
  const contract_id = `mec_${terms_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;
  const withIdentity = { ...contract, terms_hash, contract_id };
  return {
    ...withIdentity,
    body_hash: sha256Canonical(contractBody(withIdentity)),
  };
}

function recomputeEscrow(contract: MeteredEscrowContract): MeteredEscrowContract['escrow'] {
  const spent_sats = safeNumber(
    contract.usage_events.reduce((sum, event) => sum + safeBigInt(event.sats_charged, 'event.sats_charged'), 0n),
    'spent_sats'
  );
  const disputed_sats = contract.status === 'disputed' ? spent_sats : contract.escrow.disputed_sats;
  const settled_sats = TERMINAL_STATUSES.has(contract.status) && contract.status !== 'refunded' ? spent_sats : contract.escrow.settled_sats;
  const refundable_sats = safeNumber(
    [
      safeBigInt(contract.escrow.escrowed_sats, 'contract.escrow.escrowed_sats') -
        safeBigInt(spent_sats, 'spent_sats') -
        safeBigInt(disputed_sats, 'disputed_sats'),
      0n,
    ].reduce((max, value) => (value > max ? value : max)),
    'refundable_sats'
  );
  return {
    escrowed_sats: contract.escrow.escrowed_sats,
    spent_sats,
    refundable_sats,
    settled_sats,
    disputed_sats,
  };
}

function withEscrow(contract: MeteredEscrowContract): MeteredEscrowContract {
  return completeContract({
    ...contract,
    escrow: recomputeEscrow(contract),
  });
}

export function createMeteredEscrowContract(options: CreateMeteredEscrowContractOptions): MeteredEscrowContract {
  const card = options.tokenServiceCard;
  const issuedAt = options.issuedAt ?? new Date().toISOString();
  const expiresAt =
    options.expiresAt === undefined && card.limits.expires_after_minutes
      ? new Date(new Date(issuedAt).getTime() + card.limits.expires_after_minutes * 60_000).toISOString()
      : options.expiresAt ?? card.service.expires_at;

  const contract = completeContract({
    schema: METERED_ESCROW_SCHEMA,
    contract_id: '',
    terms_hash: '',
    body_hash: '',
    issued_at: issuedAt,
    updated_at: options.updatedAt ?? issuedAt,
    token_service_card_id: card.card_id,
    token_service_card_hash: card.body_hash,
    buyer_agent_id: options.buyerAgentId,
    seller_agent_id: card.seller.agent_id,
    status: options.status ?? 'funded',
    pricing: {
      currency: card.pricing.currency,
      unit: card.pricing.unit,
      input_sats: card.pricing.input_sats,
      output_sats: card.pricing.output_sats,
      cached_input_sats: card.pricing.cached_input_sats,
      request_minimum_sats: card.pricing.request_minimum_sats,
      max_contract_sats: card.pricing.max_contract_sats,
    },
    limits: {
      max_context_tokens: card.limits.max_context_tokens,
      max_output_tokens: card.limits.max_output_tokens,
      max_requests_per_contract: card.limits.max_requests_per_contract,
      expires_after_minutes: card.limits.expires_after_minutes,
      expires_at: expiresAt,
    },
    metering: {
      method: card.metering.method,
      token_counter: card.metering.token_counter,
      idempotency: card.metering.idempotency,
    },
    escrow: {
      escrowed_sats: options.escrowedSats,
      spent_sats: 0,
      refundable_sats: options.escrowedSats,
      settled_sats: 0,
      disputed_sats: 0,
    },
    settlement: {
      dispute_window_minutes: card.settlement.dispute_window_minutes,
      refund_unused_sats: card.settlement.refund_unused_sats,
      partial_settlement: card.settlement.partial_settlement,
    },
    usage_events: [],
    links: options.links,
  });

  const verification = verifyMeteredEscrowContract(contract);
  if (!verification.valid) {
    throw new Error(`Invalid metered escrow contract: ${verification.codes.join(', ')}`);
  }

  return contract;
}

export function quoteMeteredUsage(contract: MeteredEscrowContract, usage: MeteredUsageInput): MeteredUsageQuote {
  const denominator = pricingDenominator(contract.pricing.unit);
  const input_sats = ceilingDiv(
    safeBigInt(usage.inputTokens, 'usage.inputTokens') * safeBigInt(contract.pricing.input_sats, 'contract.pricing.input_sats'),
    denominator
  );
  const output_sats = ceilingDiv(
    safeBigInt(usage.outputTokens, 'usage.outputTokens') * safeBigInt(contract.pricing.output_sats, 'contract.pricing.output_sats'),
    denominator
  );
  const cached_input_sats = ceilingDiv(
    safeBigInt(usage.cachedInputTokens, 'usage.cachedInputTokens') *
      safeBigInt(contract.pricing.cached_input_sats ?? contract.pricing.input_sats, 'contract.pricing.cached_input_sats'),
    denominator
  );
  const rawTotal = input_sats + output_sats + cached_input_sats;
  const minimum = safeBigInt(contract.pricing.request_minimum_sats, 'contract.pricing.request_minimum_sats');
  const minimum_applied_sats = rawTotal > 0n && rawTotal < minimum ? minimum - rawTotal : 0n;
  const total_sats = rawTotal + minimum_applied_sats;
  const remaining_before_sats =
    safeBigInt(contract.escrow.escrowed_sats, 'contract.escrow.escrowed_sats') -
    safeBigInt(contract.escrow.spent_sats, 'contract.escrow.spent_sats') -
    safeBigInt(contract.escrow.disputed_sats, 'contract.escrow.disputed_sats');
  const clamped_remaining_before_sats = remaining_before_sats > 0n ? remaining_before_sats : 0n;

  return {
    input_sats: safeNumber(input_sats, 'input_sats'),
    output_sats: safeNumber(output_sats, 'output_sats'),
    cached_input_sats: safeNumber(cached_input_sats, 'cached_input_sats'),
    minimum_applied_sats: safeNumber(minimum_applied_sats, 'minimum_applied_sats'),
    total_sats: safeNumber(total_sats, 'total_sats'),
    remaining_before_sats: safeNumber(clamped_remaining_before_sats, 'remaining_before_sats'),
    remaining_after_sats: safeNumber(clamped_remaining_before_sats - total_sats, 'remaining_after_sats'),
  };
}

export function applyMeteredUsage(contract: MeteredEscrowContract, usage: MeteredUsageInput): MeteredUsageApplyResult {
  const codes: MeteredUsageApplyResult['codes'] = [];
  const reasons: string[] = [];
  const usageTokens = tokenCountSum(usage.inputTokens, usage.outputTokens, usage.cachedInputTokens);
  const contextTokens = tokenCountSum(usage.inputTokens, 0, usage.cachedInputTokens);
  const outputTokens = checkedBigInt(usage.outputTokens);
  const maxContextTokens = checkedBigInt(contract.limits.max_context_tokens);
  const maxOutputTokens = checkedBigInt(contract.limits.max_output_tokens);

  if (!SPENDABLE_STATUSES.has(contract.status)) {
    codes.push('contract_not_spendable');
    reasons.push(`Contract status ${contract.status} cannot accept metered usage.`);
  }

  if (
    !usage.requestId ||
    !usage.modelId ||
    !nonNegativeInteger(usage.inputTokens) ||
    !nonNegativeInteger(usage.outputTokens) ||
    (usage.cachedInputTokens !== undefined && !nonNegativeInteger(usage.cachedInputTokens)) ||
    usageTokens === null ||
    usageTokens <= 0n
  ) {
    codes.push('invalid_usage');
    reasons.push('Usage must include request/model ids and non-negative token counts with at least one token.');
  }

  if (contextTokens !== null && maxContextTokens !== null && contextTokens > maxContextTokens) {
    codes.push('usage_exceeds_limits');
    reasons.push('Input token usage exceeds contract context limit.');
  }
  if (outputTokens !== null && maxOutputTokens !== null && outputTokens > maxOutputTokens) {
    codes.push('usage_exceeds_limits');
    reasons.push('Output token usage exceeds contract output limit.');
  }
  if (
    contract.limits.max_requests_per_contract !== undefined &&
    contract.usage_events.length >= contract.limits.max_requests_per_contract
  ) {
    codes.push('request_limit_exceeded');
    reasons.push('Contract request limit has already been reached.');
  }
  if (contract.usage_events.some((event) => event.request_id === usage.requestId)) {
    codes.push('duplicate_request_id');
    reasons.push('Request id has already been charged on this contract.');
  }

  let quote: MeteredUsageQuote | undefined;
  try {
    quote = quoteMeteredUsage(contract, usage);
  } catch (error) {
    codes.push('invalid_usage');
    reasons.push(error instanceof Error ? error.message : 'Usage quote could not be computed safely.');
  }

  if (codes.length > 0) {
    return { applied: false, codes: Array.from(new Set(codes)), reasons, quote, contract };
  }
  if (!quote) {
    return {
      applied: false,
      codes: ['invalid_usage'],
      reasons: ['Usage quote could not be computed safely.'],
      contract,
    };
  }

  if (quote.total_sats <= 0) {
    codes.push('invalid_usage');
    reasons.push('Usage quote must produce a positive sats charge.');
  }
  if (quote.remaining_after_sats < 0) {
    codes.push('insufficient_escrow');
    reasons.push('Usage charge would exceed remaining prepaid escrow.');
  }
  if (contract.metering.method === 'seller_signed_usage') {
    if (!usage.sellerSignature) {
      codes.push('missing_signature');
      reasons.push('Seller-signed metering requires a seller signature.');
    }
    if (!usage.sellerPublicKeyPem) {
      codes.push('missing_public_key');
      reasons.push('Seller-signed metering requires the seller public key.');
    }
    if (
      usage.sellerSignature &&
      usage.sellerPublicKeyPem &&
      !verifyMeteredUsageSignature(
        createMeteredUsageSignaturePayload(contract, usage, quote),
        usage.sellerSignature,
        usage.sellerPublicKeyPem
      )
    ) {
      codes.push('invalid_signature');
      reasons.push('Seller usage signature does not verify against the metered usage payload.');
    }
  }

  if (codes.length > 0) {
    return { applied: false, codes, reasons, quote, contract };
  }

  const event = completeUsageEvent({
    schema: USAGE_EVENT_SCHEMA,
    event_id: '',
    request_id: usage.requestId,
    contract_id: contract.contract_id,
    created_at: usage.createdAt ?? new Date().toISOString(),
    model_id: usage.modelId,
    input_tokens: usage.inputTokens,
    output_tokens: usage.outputTokens,
    cached_input_tokens: usage.cachedInputTokens,
    sats_charged: quote.total_sats,
    metering_source: usage.meteringSource ?? contract.metering.method,
    seller_signature: usage.sellerSignature,
    seller_public_key_pem: usage.sellerPublicKeyPem,
    buyer_acknowledged: usage.buyerAcknowledged,
    prompt_hash: usage.promptHash,
    completion_hash: usage.completionHash,
    metadata_hash: usage.metadataHash,
  });

  const nextStatus = quote.remaining_after_sats === 0 ? 'exhausted' : 'active';
  const nextContract = withEscrow({
    ...contract,
    status: nextStatus,
    updated_at: event.created_at,
    usage_events: [...contract.usage_events, event],
  });

  return {
    applied: true,
    codes: ['applied'],
    reasons: [],
    quote,
    event,
    contract: nextContract,
  };
}

export function closeMeteredEscrowContract(
  contract: MeteredEscrowContract,
  status: Extract<MeteredEscrowContractStatus, 'completed' | 'refunded' | 'disputed' | 'expired'> = 'completed',
  closedAt = new Date().toISOString()
): MeteredEscrowContract {
  return withEscrow({
    ...contract,
    status,
    updated_at: closedAt,
  });
}

export function verifyMeteredEscrowContract(contract: MeteredEscrowContract): MeteredEscrowVerificationResult {
  const codes: MeteredEscrowVerificationCode[] = [];

  if (contract.schema !== METERED_ESCROW_SCHEMA) codes.push('unsupported_schema');
  if (!contract.contract_id) codes.push('missing_contract_id');
  if (!contract.terms_hash) codes.push('missing_terms_hash');
  if (!contract.body_hash) codes.push('missing_body_hash');
  if (!contract.token_service_card_id || !contract.token_service_card_hash) codes.push('missing_token_service_card_ref');

  const expected_terms_hash = sha256Canonical(contractTermsBody(contract));
  const expected_contract_id = `mec_${expected_terms_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;
  const expected_body_hash = sha256Canonical(contractBody({ ...contract, terms_hash: expected_terms_hash, contract_id: expected_contract_id }));

  if (contract.terms_hash && contract.terms_hash !== expected_terms_hash) codes.push('terms_hash_mismatch');
  if (contract.contract_id && contract.contract_id !== expected_contract_id) codes.push('contract_id_mismatch');
  if (contract.body_hash && contract.body_hash !== expected_body_hash) codes.push('body_hash_mismatch');

  const statuses: MeteredEscrowContractStatus[] = [
    'accepted',
    'funded',
    'active',
    'exhausted',
    'completed',
    'refunded',
    'disputed',
    'resolved',
    'expired',
  ];
  if (!statuses.includes(contract.status)) codes.push('invalid_status');

  if (
    contract.pricing.currency !== 'sats' ||
    !nonNegativeInteger(contract.pricing.input_sats) ||
    !nonNegativeInteger(contract.pricing.output_sats) ||
    (contract.pricing.cached_input_sats !== undefined && !nonNegativeInteger(contract.pricing.cached_input_sats)) ||
    (contract.pricing.request_minimum_sats !== undefined && !nonNegativeInteger(contract.pricing.request_minimum_sats)) ||
    (contract.pricing.input_sats === 0 && contract.pricing.output_sats === 0) ||
    !positiveInteger(contract.pricing.max_contract_sats)
  ) {
    codes.push('invalid_price');
  }

  if (
    !positiveInteger(contract.escrow.escrowed_sats) ||
    contract.escrow.escrowed_sats > contract.pricing.max_contract_sats ||
    !nonNegativeInteger(contract.escrow.spent_sats) ||
    !nonNegativeInteger(contract.escrow.refundable_sats) ||
    !nonNegativeInteger(contract.escrow.settled_sats) ||
    !nonNegativeInteger(contract.escrow.disputed_sats)
  ) {
    codes.push('invalid_escrow_amount');
  }

  const seenRequestIds = new Set<string>();
  let usageSum = 0n;
  for (const event of contract.usage_events) {
    if (
      event.schema !== USAGE_EVENT_SCHEMA ||
      !event.event_id ||
      !event.request_id ||
      event.contract_id !== contract.contract_id ||
      !event.model_id ||
      !nonNegativeInteger(event.input_tokens) ||
      !nonNegativeInteger(event.output_tokens) ||
      (event.cached_input_tokens !== undefined && !nonNegativeInteger(event.cached_input_tokens)) ||
      (tokenCountSum(event.input_tokens, event.output_tokens, event.cached_input_tokens) ?? 0n) <= 0n ||
      !positiveInteger(event.sats_charged)
    ) {
      codes.push('invalid_usage_event');
    }
    if (
      contract.metering.method === 'seller_signed_usage' &&
      (!event.seller_signature ||
        !event.seller_public_key_pem ||
        !verifyMeteredUsageSignature(
          createMeteredUsageSignaturePayload(contract, event, event.sats_charged),
          event.seller_signature,
          event.seller_public_key_pem
        ))
    ) {
      codes.push('invalid_usage_event');
    }
    if (seenRequestIds.has(event.request_id)) codes.push('duplicate_request_id');
    seenRequestIds.add(event.request_id);
    usageSum += checkedBigInt(event.sats_charged) ?? 0n;
  }

  const escrowed = checkedBigInt(contract.escrow.escrowed_sats);
  const spent = checkedBigInt(contract.escrow.spent_sats);
  const disputed = checkedBigInt(contract.escrow.disputed_sats);
  const refundable = checkedBigInt(contract.escrow.refundable_sats);

  if (spent !== null && usageSum !== spent) codes.push('usage_sum_mismatch');
  if (escrowed !== null && usageSum > escrowed) codes.push('spend_exceeds_escrow');

  if (escrowed !== null && spent !== null && disputed !== null && refundable !== null) {
    const expectedRefundable = escrowed - spent - disputed;
    const clampedExpectedRefundable = expectedRefundable > 0n ? expectedRefundable : 0n;
    if (refundable !== clampedExpectedRefundable) codes.push('refund_math_mismatch');
  }

  if (contract.limits.expires_at && Number.isNaN(Date.parse(contract.limits.expires_at))) codes.push('invalid_expiry');

  return {
    valid: codes.length === 0,
    codes: codes.length ? Array.from(new Set(codes)) : ['valid'],
    expected_contract_id,
    expected_terms_hash,
    expected_body_hash,
  };
}
