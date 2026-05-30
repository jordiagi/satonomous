import { createHash } from 'node:crypto';
import type {
  CreateTokenServiceCardOptions,
  TokenServiceCard,
  TokenServiceCardVerificationCode,
  TokenServiceCardVerificationResult,
} from './types.js';

const TOKEN_SERVICE_CARD_SCHEMA = 'satonomous.token-service-card/v0' as const;

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
}

function sha256(value: unknown): string {
  const json = JSON.stringify(canonicalize(value));
  return `sha256:${createHash('sha256').update(json).digest('hex')}`;
}

function tokenServiceCardBody(card: TokenServiceCard): Omit<TokenServiceCard, 'card_id' | 'body_hash'> {
  const { card_id: _cardId, body_hash: _bodyHash, ...body } = card;
  return body;
}

function completeTokenServiceCard(card: TokenServiceCard): TokenServiceCard {
  const body_hash = sha256(tokenServiceCardBody(card));
  return {
    ...card,
    body_hash,
    card_id: `tsc_${body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
  };
}

function positive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function nonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function createTokenServiceCard(options: CreateTokenServiceCardOptions): TokenServiceCard {
  return completeTokenServiceCard({
    schema: TOKEN_SERVICE_CARD_SCHEMA,
    card_id: '',
    body_hash: '',
    issued_at: options.issuedAt ?? new Date().toISOString(),
    seller: options.seller,
    service: options.service,
    inference: options.inference,
    pricing: options.pricing,
    limits: options.limits,
    metering: {
      usage_receipt_schema: 'satonomous.token-usage-receipt/v0',
      idempotency: 'request_id',
      ...options.metering,
    },
    privacy: options.privacy,
    settlement: {
      escrow_policy: 'prepaid_metered_escrow',
      settlement_policy: 'usage_release_unused_refund',
      ...options.settlement,
    },
    accept: options.accept,
    links: options.links,
  });
}

export function verifyTokenServiceCard(card: TokenServiceCard): TokenServiceCardVerificationResult {
  const codes: TokenServiceCardVerificationCode[] = [];
  const warnings: TokenServiceCardVerificationCode[] = [];

  if (card.schema !== TOKEN_SERVICE_CARD_SCHEMA) codes.push('unsupported_schema');
  if (!card.card_id) codes.push('missing_card_id');
  if (!card.body_hash) codes.push('missing_body_hash');
  if (!card.service?.active) codes.push('inactive_service');
  if (!card.accept?.accept_url) codes.push('missing_accept_url');

  const expected_body_hash = sha256(tokenServiceCardBody(card));
  const expected_card_id = `tsc_${expected_body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;

  if (card.body_hash && card.body_hash !== expected_body_hash) codes.push('body_hash_mismatch');
  if (card.card_id && card.card_id !== expected_card_id) codes.push('card_id_mismatch');

  if (!Array.isArray(card.inference?.models) || card.inference.models.length === 0) {
    codes.push('missing_model');
  }

  if (!card.pricing) {
    codes.push('missing_pricing');
  } else {
    if (!nonNegative(card.pricing.input_sats) || !nonNegative(card.pricing.output_sats)) {
      codes.push('invalid_price');
    }
    if ((card.pricing.input_sats ?? 0) === 0 && (card.pricing.output_sats ?? 0) === 0) {
      codes.push('invalid_price');
    }
    if (card.pricing.cached_input_sats !== undefined && !nonNegative(card.pricing.cached_input_sats)) {
      codes.push('invalid_price');
    }
    if (!positive(card.pricing.max_contract_sats)) codes.push('missing_budget_cap');
  }

  if (!positive(card.limits?.max_context_tokens) || !positive(card.limits?.max_output_tokens)) {
    codes.push('invalid_limit');
  }

  if (!card.metering?.method || !card.metering?.token_counter) {
    codes.push('missing_metering');
  }

  const provider = card.inference?.provider;
  if (!provider?.seller_attests_authorized || !provider.attestation) {
    codes.push('missing_authorization_attestation');
  }
  if (provider?.authorization_basis === 'prohibited_risk') {
    codes.push('prohibited_resale_risk');
  }

  const policyFlags = card.seller?.trust?.policy_flags ?? [];
  if (policyFlags.includes('raw_api_key_resale')) codes.push('raw_credential_resale');

  if (provider?.disclosure === 'undisclosed') warnings.push('undisclosed_provider');
  if (provider?.authorization_basis === 'unknown') warnings.push('unknown_resale_rights');
  if (!card.settlement?.dispute_window_minutes) warnings.push('missing_sla');
  if (!card.seller?.reputation) warnings.push('missing_reputation');
  if (card.metering && !card.metering.dry_run_quote) warnings.push('no_dry_run_quote');
  if (card.privacy?.log_prompts) warnings.push('prompt_logging_enabled');
  if (card.privacy?.log_completions) warnings.push('completion_logging_enabled');
  if (card.privacy?.training_use) warnings.push('training_use_enabled');

  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ['valid'],
    warnings,
    expected_card_id,
    expected_body_hash,
  };
}
