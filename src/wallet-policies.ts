import { sha256Canonical } from './canonical-json.js';
import type {
  CreateWalletPolicyOptions,
  WalletPolicy,
  WalletPolicyContext,
  WalletPolicyDecision,
  WalletPolicyDecisionCode,
  WalletPolicySpendRequest,
  WalletPolicyVerificationCode,
  WalletPolicyVerificationResult,
} from './types.js';

const WALLET_POLICY_SCHEMA = 'satonomous.wallet-policy/v0' as const;

function policyBody(policy: WalletPolicy): Omit<WalletPolicy, 'policy_id' | 'body_hash'> {
  const { policy_id: _policyId, body_hash: _bodyHash, ...body } = policy;
  return body;
}

function completeWalletPolicy(policy: WalletPolicy): WalletPolicy {
  const body_hash = sha256Canonical(policyBody(policy));
  return {
    ...policy,
    body_hash,
    policy_id: `wp_${body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`,
  };
}

function isNonNegativeNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function pushReason(
  codes: WalletPolicyDecisionCode[],
  reasons: string[],
  code: WalletPolicyDecisionCode,
  reason: string
): void {
  codes.push(code);
  reasons.push(reason);
}

function unique(values?: string[]): string[] | undefined {
  const cleaned = Array.from(new Set((values ?? []).map(String).filter(Boolean)));
  return cleaned.length ? cleaned : undefined;
}

export function createWalletPolicy(options: CreateWalletPolicyOptions = {}): WalletPolicy {
  return completeWalletPolicy({
    schema: WALLET_POLICY_SCHEMA,
    policy_id: '',
    body_hash: '',
    issued_at: options.issuedAt ?? new Date().toISOString(),
    agent_id: options.agentId,
    limits: options.limits ?? {},
    approvals: options.approvals ?? {},
    allowlists: {
      service_types: unique(options.allowlists?.service_types),
      counterparties: unique(options.allowlists?.counterparties),
    },
    denylists: {
      service_types: unique(options.denylists?.service_types),
      counterparties: unique(options.denylists?.counterparties),
    },
    expires_at: options.expiresAt ?? null,
    notes: options.notes,
  });
}

export function verifyWalletPolicy(policy: WalletPolicy): WalletPolicyVerificationResult {
  const codes: WalletPolicyVerificationCode[] = [];

  if (policy.schema !== WALLET_POLICY_SCHEMA) codes.push('unsupported_schema');
  if (!policy.policy_id) codes.push('missing_policy_id');
  if (!policy.body_hash) codes.push('missing_body_hash');

  const expected_body_hash = sha256Canonical(policyBody(policy));
  const expected_policy_id = `wp_${expected_body_hash.slice('sha256:'.length, 'sha256:'.length + 32)}`;

  if (policy.body_hash && policy.body_hash !== expected_body_hash) codes.push('body_hash_mismatch');
  if (policy.policy_id && policy.policy_id !== expected_policy_id) codes.push('policy_id_mismatch');

  for (const value of [
    policy.limits?.max_contract_price_sats,
    policy.limits?.max_contract_total_sats,
    policy.limits?.daily_spend_limit_sats,
    policy.limits?.max_spend_per_counterparty_sats,
    policy.approvals?.ask_human_above_sats,
  ]) {
    if (value !== undefined && !isNonNegativeNumber(value)) codes.push('invalid_limit');
  }

  const minRep = policy.limits?.min_seller_reputation;
  if (minRep !== undefined && (!isNonNegativeNumber(minRep) || minRep > 100)) {
    codes.push('invalid_reputation_threshold');
  }

  return {
    valid: codes.length === 0,
    codes: codes.length ? codes : ['valid'],
    expected_policy_id,
    expected_body_hash,
  };
}

export function evaluateWalletPolicy(
  policy: WalletPolicy,
  request: WalletPolicySpendRequest,
  context: WalletPolicyContext = {}
): WalletPolicyDecision {
  const denies: WalletPolicyDecisionCode[] = [];
  const asks: WalletPolicyDecisionCode[] = [];
  const reasons: string[] = [];
  const amount = request.amount_sats;
  const price = request.price_sats ?? amount;
  const total = (request.price_sats ?? amount) + (request.fee_sats ?? 0);
  const verification = verifyWalletPolicy(policy);

  if (!verification.valid) {
    pushReason(denies, reasons, 'invalid_policy', `WalletPolicy failed verification: ${verification.codes.join(', ')}`);
  }

  if (policy.expires_at && Date.parse(policy.expires_at) <= Date.parse(context.now ?? new Date().toISOString())) {
    pushReason(denies, reasons, 'deny_policy_expired', `WalletPolicy expired at ${policy.expires_at}`);
  }

  const limits = policy.limits ?? {};
  if (limits.max_contract_price_sats !== undefined && price > limits.max_contract_price_sats) {
    pushReason(
      denies,
      reasons,
      'deny_amount_exceeds_contract_price_limit',
      `${price} sats price exceeds max_contract_price_sats ${limits.max_contract_price_sats}`
    );
  }

  if (limits.max_contract_total_sats !== undefined && total > limits.max_contract_total_sats) {
    pushReason(
      denies,
      reasons,
      'deny_amount_exceeds_contract_total_limit',
      `${total} sats total exceeds max_contract_total_sats ${limits.max_contract_total_sats}`
    );
  }

  if (
    limits.daily_spend_limit_sats !== undefined &&
    (context.daily_spent_sats ?? 0) + amount > limits.daily_spend_limit_sats
  ) {
    pushReason(
      denies,
      reasons,
      'deny_daily_spend_limit',
      `${(context.daily_spent_sats ?? 0) + amount} sats would exceed daily_spend_limit_sats ${limits.daily_spend_limit_sats}`
    );
  }

  if (
    limits.max_spend_per_counterparty_sats !== undefined &&
    (context.counterparty_spent_sats ?? 0) + amount > limits.max_spend_per_counterparty_sats
  ) {
    pushReason(
      denies,
      reasons,
      'deny_counterparty_spend_limit',
      `${(context.counterparty_spent_sats ?? 0) + amount} sats would exceed max_spend_per_counterparty_sats ${limits.max_spend_per_counterparty_sats}`
    );
  }

  const counterparty = request.counterparty_tenant_id;
  const deniedCounterparties = policy.denylists?.counterparties ?? [];
  const allowedCounterparties = policy.allowlists?.counterparties ?? [];
  if (counterparty && deniedCounterparties.includes(counterparty)) {
    pushReason(denies, reasons, 'deny_counterparty_denied', `${counterparty} is in the counterparty denylist`);
  }
  if (counterparty && allowedCounterparties.length > 0 && !allowedCounterparties.includes(counterparty)) {
    pushReason(denies, reasons, 'deny_counterparty_not_allowed', `${counterparty} is not in the counterparty allowlist`);
  }

  const serviceType = request.service_type ?? undefined;
  const deniedServices = policy.denylists?.service_types ?? [];
  const allowedServices = policy.allowlists?.service_types ?? [];
  if (serviceType && deniedServices.includes(serviceType)) {
    pushReason(denies, reasons, 'deny_service_type_denied', `${serviceType} is in the service type denylist`);
  }
  if (serviceType && allowedServices.length > 0 && !allowedServices.includes(serviceType)) {
    pushReason(denies, reasons, 'deny_service_type_not_allowed', `${serviceType} is not in the service type allowlist`);
  }

  if (
    limits.min_seller_reputation !== undefined &&
    context.seller_reputation_score !== undefined &&
    context.seller_reputation_score !== null &&
    context.seller_reputation_score < limits.min_seller_reputation
  ) {
    pushReason(
      denies,
      reasons,
      'deny_min_seller_reputation',
      `${context.seller_reputation_score} seller reputation is below minimum ${limits.min_seller_reputation}`
    );
  }

  const approvals = policy.approvals ?? {};
  if (approvals.ask_human_above_sats !== undefined && amount > approvals.ask_human_above_sats) {
    pushReason(
      asks,
      reasons,
      'ask_human_amount_above_threshold',
      `${amount} sats exceeds ask_human_above_sats ${approvals.ask_human_above_sats}`
    );
  }

  if (
    approvals.ask_human_for_unrated_counterparty &&
    (context.seller_reputation_score === undefined || context.seller_reputation_score === null)
  ) {
    pushReason(asks, reasons, 'ask_human_unrated_counterparty', 'seller reputation is unavailable');
  }

  if (denies.length > 0) {
    return {
      decision: 'deny',
      codes: denies,
      reasons,
      amount_sats: amount,
      policy_id: policy.policy_id,
    };
  }

  if (asks.length > 0) {
    return {
      decision: 'ask_human',
      codes: asks,
      reasons,
      amount_sats: amount,
      policy_id: policy.policy_id,
    };
  }

  return {
    decision: 'allow',
    codes: ['allowed'],
    reasons: ['WalletPolicy allows this spend'],
    amount_sats: amount,
    policy_id: policy.policy_id,
  };
}
