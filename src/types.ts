export interface L402AgentOptions {
  apiKey: string;
  apiUrl?: string;  // default: https://l402gw.nosaltres2.info
  walletPolicy?: WalletPolicy;

  /**
   * Called when the agent needs a Lightning invoice paid.
   *
   * AI agents cannot pay Lightning invoices themselves — they don't have wallets.
   * When a deposit is needed, the agent calls this callback so YOU can:
   * - Forward the invoice to a human via chat/notification
   * - Pay it from an external wallet/service
   * - Display it in a UI for manual payment
   *
   * If not provided, `deposit()` returns the invoice and the caller is
   * responsible for payment coordination.
   */
  onPaymentNeeded?: (invoice: DepositInvoice) => Promise<void> | void;

  /**
   * How long to wait (ms) for payment after calling onPaymentNeeded.
   * Default: 300_000 (5 minutes). Set to 0 to skip polling.
   */
  paymentTimeoutMs?: number;

  /**
   * How often to poll (ms) for payment confirmation.
   * Default: 5_000 (5 seconds).
   */
  paymentPollIntervalMs?: number;

  /**
   * Called when walletPolicy returns `ask_human`.
   * Return true to approve the spend; return false/void to block it.
   */
  onPolicyApprovalNeeded?: (decision: WalletPolicyDecision) => Promise<boolean | void> | boolean | void;
}

export interface BalanceInfo {
  balance_sats: number;
}

export interface Offer {
  id: string;
  seller_tenant_id: string;
  service_type: string;
  title: string;
  description: string | null;
  terms: { sla_minutes?: number; dispute_window_minutes?: number; [key: string]: any };
  price_sats: number;
  max_concurrent_contracts: number;
  active: number;
  created_at: string;
  expires_at: string | null;
  seller_reputation?: OfferSellerReputation;
}

export type ReputationLevel = 'new' | 'bronze' | 'silver' | 'gold' | 'platinum';
export type OfferSort = 'created_at' | 'price' | 'reputation';

export interface OfferSellerReputation {
  score: number;
  level: ReputationLevel;
  completed_contracts: number;
  settled_contracts: number;
  dispute_rate: number;
  total_volume_sats: number;
  unique_counterparties: number;
}

export interface ListOffersParams {
  service_type?: string;
  min_reputation?: number;
  hide_unrated?: boolean;
  sort?: OfferSort;
  limit?: number;
  offset?: number;
}

export interface SellerReputationSummary {
  settled_contracts: number;
  completed_contracts: number;
  released_contracts: number;
  disputed_contracts: number;
  seller_lost_disputes: number;
  expired_delivery_contracts: number;
  dispute_rate: number;
  seller_win_rate: number | null;
  median_delivery_minutes: number | null;
  total_volume_sats: number;
  unique_counterparties: number;
}

export interface BuyerReputationSummary {
  settled_contracts: number;
  funded_contracts: number;
  released_contracts: number;
  disputes_opened: number;
  buyer_lost_disputes: number;
  dispute_rate: number;
  total_volume_sats: number;
  unique_counterparties: number;
}

export interface RoleReputation<TSummary> {
  tenant_id: string;
  role: 'seller' | 'buyer';
  score: number;
  level: ReputationLevel;
  summary: TSummary;
  last_updated_at: string;
}

export interface TenantReputation {
  tenant_id: string;
  seller: RoleReputation<SellerReputationSummary>;
  buyer: RoleReputation<BuyerReputationSummary>;
}

export interface TenantInfo {
  tenant_id: string;
  email: string;
  site_url: string | null;
  fee_pct: number;
  balance_sats: number;
  email_verified: boolean;
  created_at: string;
  enabled: boolean;
}

export interface CreateOfferParams {
  title: string;
  description?: string;
  price_sats: number;
  service_type: string;
  sla_minutes?: number;         // default 30
  dispute_window_minutes?: number; // default 1440
}

export interface Contract {
  id: string;
  offer_id: string;
  buyer_tenant_id: string;
  seller_tenant_id: string;
  terms_snapshot: any;
  price_sats: number;
  fee_sats: number;
  status: string;
  delivery_proof: any;
  dispute_reason: string | null;
  accepted_at: string;
  funded_at: string | null;
  completed_at: string | null;
  released_at: string | null;
  disputed_at: string | null;
  created_at: string;
}

export interface WalletPolicy {
  schema: 'satonomous.wallet-policy/v0';
  policy_id: string;
  body_hash: string;
  issued_at: string;
  agent_id?: string;
  limits: {
    max_contract_price_sats?: number;
    max_contract_total_sats?: number;
    daily_spend_limit_sats?: number;
    max_spend_per_counterparty_sats?: number;
    min_seller_reputation?: number;
  };
  approvals: {
    ask_human_above_sats?: number;
    ask_human_for_unrated_counterparty?: boolean;
  };
  allowlists?: {
    service_types?: string[];
    counterparties?: string[];
  };
  denylists?: {
    service_types?: string[];
    counterparties?: string[];
  };
  expires_at?: string | null;
  notes?: string;
}

export interface CreateWalletPolicyOptions {
  issuedAt?: string;
  agentId?: string;
  limits?: WalletPolicy['limits'];
  approvals?: WalletPolicy['approvals'];
  allowlists?: WalletPolicy['allowlists'];
  denylists?: WalletPolicy['denylists'];
  expiresAt?: string | null;
  notes?: string;
}

export type WalletPolicyVerificationCode =
  | 'valid'
  | 'unsupported_schema'
  | 'missing_policy_id'
  | 'missing_body_hash'
  | 'body_hash_mismatch'
  | 'policy_id_mismatch'
  | 'invalid_limit'
  | 'invalid_reputation_threshold';

export interface WalletPolicyVerificationResult {
  valid: boolean;
  codes: WalletPolicyVerificationCode[];
  expected_policy_id?: string;
  expected_body_hash?: string;
}

export interface WalletPolicySpendRequest {
  amount_sats: number;
  price_sats?: number;
  fee_sats?: number;
  counterparty_tenant_id?: string;
  service_type?: string | null;
  offer_id?: string;
  contract_id?: string;
  description?: string;
}

export interface WalletPolicyContext {
  daily_spent_sats?: number;
  counterparty_spent_sats?: number;
  seller_reputation_score?: number | null;
  now?: string;
}

export type WalletPolicyDecisionKind = 'allow' | 'deny' | 'ask_human';

export type WalletPolicyDecisionCode =
  | 'allowed'
  | 'invalid_policy'
  | 'deny_policy_expired'
  | 'deny_amount_exceeds_contract_price_limit'
  | 'deny_amount_exceeds_contract_total_limit'
  | 'deny_daily_spend_limit'
  | 'deny_counterparty_spend_limit'
  | 'deny_counterparty_denied'
  | 'deny_counterparty_not_allowed'
  | 'deny_service_type_denied'
  | 'deny_service_type_not_allowed'
  | 'deny_min_seller_reputation'
  | 'ask_human_amount_above_threshold'
  | 'ask_human_unrated_counterparty';

export interface WalletPolicyDecision {
  decision: WalletPolicyDecisionKind;
  codes: WalletPolicyDecisionCode[];
  reasons: string[];
  amount_sats: number;
  policy_id: string;
}

export interface FundContractPolicyOptions {
  policy?: WalletPolicy;
  context?: WalletPolicyContext;
  humanApproved?: boolean;
}

export type ContractRole = 'buyer' | 'seller' | 'observer';

export type ContractNextActionCode =
  | 'fund_contract'
  | 'wait_for_funding'
  | 'submit_delivery'
  | 'wait_for_delivery'
  | 'confirm_or_dispute_delivery'
  | 'wait_for_buyer_review'
  | 'review_dispute'
  | 'terminal_receipt_available'
  | 'unknown_status';

export interface ContractNextAction {
  contract_id: string;
  offer_id: string;
  status: string;
  role: ContractRole;
  actor: ContractRole | 'none';
  action: ContractNextActionCode;
  required: boolean;
  terminal: boolean;
  reason: string;
  price_sats: number;
  fee_sats: number;
  service_type: string | null;
  due_at: string | null;
  overdue: boolean;
  contract: Contract;
}

export interface ContractActionOptions {
  role?: ContractRole;
  now?: string;
}

export interface WaitForContractActionOptions extends ContractActionOptions {
  action?: ContractNextActionCode;
  status?: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}

export interface ServiceCardSellerReputation {
  score: number;
  level: ReputationLevel;
  settled_contracts: number;
  dispute_rate: number;
  total_volume_sats: number;
  unique_counterparties: number;
}

export interface ServiceCard {
  schema: 'satonomous.service-card/v0';
  card_id: string;
  body_hash: string;
  issued_at: string;
  seller: {
    agent_id: string;
    reputation: ServiceCardSellerReputation | null;
  };
  service: {
    offer_id: string;
    service_type: string;
    title: string;
    description: string | null;
    price_sats: number;
    currency: 'sats';
    active: boolean;
    created_at: string;
    expires_at: string | null;
  };
  terms: {
    sla_minutes: number | null;
    dispute_window_minutes: number | null;
    max_concurrent_contracts: number;
    escrow_policy: 'lightning_escrow';
    settlement_policy: 'release_dispute_refund';
    proof_required: boolean;
    proof_requirements: string[];
    [key: string]: any;
  };
  accept: {
    accept_url: string;
    contract_template_ref: string;
  };
  links?: {
    quickstart?: string;
    offer?: string;
    [key: string]: string | undefined;
  };
}

export interface CreateServiceCardOptions {
  issuedAt?: string;
  acceptUrl?: string;
  contractTemplateRef?: string;
  proofRequirements?: string[];
  links?: ServiceCard['links'];
}

export type ServiceCardVerificationCode =
  | 'valid'
  | 'unsupported_schema'
  | 'missing_card_id'
  | 'missing_body_hash'
  | 'body_hash_mismatch'
  | 'card_id_mismatch'
  | 'inactive_offer'
  | 'missing_accept_url'
  | 'missing_price'
  | 'missing_sla'
  | 'invalid_reputation';

export interface ServiceCardVerificationResult {
  valid: boolean;
  codes: ServiceCardVerificationCode[];
  warnings: ServiceCardVerificationCode[];
  expected_card_id?: string;
  expected_body_hash?: string;
}

export type TokenServiceProviderType = 'local' | 'hosted' | 'byok' | 'brokered' | 'aggregator' | 'unknown';
export type TokenServiceProviderDisclosure = 'exact' | 'class' | 'undisclosed';
export type TokenServiceAuthorizationBasis =
  | 'own_infrastructure'
  | 'authorized_resale'
  | 'aggregator_terms'
  | 'unknown'
  | 'prohibited_risk';
export type TokenServicePricingUnit = 'per_1k_tokens' | 'per_1m_tokens';
export type TokenServiceMeteringMethod = 'seller_signed_usage' | 'gateway_verified' | 'buyer_acknowledged';
export type TokenServiceRetentionMode = 'none' | 'hash_only' | 'redacted' | 'full' | 'custom';

export interface TokenServiceModel {
  id: string;
  display_name?: string;
  max_context_tokens?: number;
  max_output_tokens?: number;
  modalities?: Array<'text' | 'vision' | 'audio' | 'embedding' | 'tool_call'>;
}

export interface TokenServiceCard {
  schema: 'satonomous.token-service-card/v0';
  card_id: string;
  body_hash: string;
  issued_at: string;
  seller: {
    agent_id: string;
    payout?: {
      lightning_address?: string;
      lnurl?: string;
    };
    reputation: ServiceCardSellerReputation | null;
    trust?: {
      tier?: 'anonymous' | 'verified' | 'business' | 'infrastructure';
      policy_flags?: string[];
    };
  };
  service: {
    service_type: 'llm_inference';
    title: string;
    description: string | null;
    active: boolean;
    created_at: string;
    expires_at: string | null;
  };
  inference: {
    api: 'openai-compatible' | 'custom';
    endpoint?: string;
    models: TokenServiceModel[];
    supports?: {
      chat_completions?: boolean;
      embeddings?: boolean;
      streaming?: boolean;
      tools?: boolean;
      json_mode?: boolean;
      vision?: boolean;
    };
    provider: {
      type: TokenServiceProviderType;
      name?: string;
      disclosure: TokenServiceProviderDisclosure;
      authorization_basis: TokenServiceAuthorizationBasis;
      seller_attests_authorized: boolean;
      attestation?: string;
    };
  };
  pricing: {
    currency: 'sats';
    unit: TokenServicePricingUnit;
    input_sats: number;
    output_sats: number;
    cached_input_sats?: number;
    request_minimum_sats?: number;
    minimum_contract_sats?: number;
    max_contract_sats: number;
    quote_ttl_seconds?: number;
    discount?: {
      reference_provider?: string;
      reference_input_sats?: number;
      reference_output_sats?: number;
      min_discount_pct?: number;
    };
  };
  limits: {
    max_context_tokens: number;
    max_output_tokens: number;
    max_requests_per_contract?: number;
    max_requests_per_minute?: number;
    max_concurrent_requests?: number;
    expires_after_minutes?: number;
  };
  metering: {
    method: TokenServiceMeteringMethod;
    usage_receipt_schema: 'satonomous.token-usage-receipt/v0';
    token_counter: 'provider' | 'gateway' | 'tiktoken' | 'custom';
    dry_run_quote: boolean;
    idempotency: 'request_id';
  };
  privacy: {
    retention: TokenServiceRetentionMode;
    log_prompts: boolean;
    log_completions: boolean;
    training_use: boolean;
    public_receipts: 'hash_only' | 'redacted' | 'private';
  };
  settlement: {
    escrow_policy: 'prepaid_metered_escrow';
    settlement_policy: 'usage_release_unused_refund';
    dispute_window_minutes: number;
    refund_unused_sats: boolean;
    partial_settlement: boolean;
  };
  accept: {
    accept_url: string;
    contract_template_ref: string;
  };
  links?: {
    quickstart?: string;
    offer?: string;
    docs?: string;
    [key: string]: string | undefined;
  };
}

export interface CreateTokenServiceCardOptions {
  issuedAt?: string;
  seller: TokenServiceCard['seller'];
  service: TokenServiceCard['service'];
  inference: TokenServiceCard['inference'];
  pricing: TokenServiceCard['pricing'];
  limits: TokenServiceCard['limits'];
  metering: Omit<TokenServiceCard['metering'], 'usage_receipt_schema' | 'idempotency'> &
    Partial<Pick<TokenServiceCard['metering'], 'usage_receipt_schema' | 'idempotency'>>;
  privacy: TokenServiceCard['privacy'];
  settlement: Omit<TokenServiceCard['settlement'], 'escrow_policy' | 'settlement_policy'> &
    Partial<Pick<TokenServiceCard['settlement'], 'escrow_policy' | 'settlement_policy'>>;
  accept: TokenServiceCard['accept'];
  links?: TokenServiceCard['links'];
}

export type TokenServiceCardVerificationCode =
  | 'valid'
  | 'unsupported_schema'
  | 'missing_card_id'
  | 'missing_body_hash'
  | 'body_hash_mismatch'
  | 'card_id_mismatch'
  | 'inactive_service'
  | 'missing_accept_url'
  | 'missing_model'
  | 'missing_pricing'
  | 'invalid_price'
  | 'missing_budget_cap'
  | 'invalid_limit'
  | 'missing_metering'
  | 'missing_authorization_attestation'
  | 'prohibited_resale_risk'
  | 'raw_credential_resale'
  | 'undisclosed_provider'
  | 'unknown_resale_rights'
  | 'missing_sla'
  | 'missing_reputation'
  | 'no_dry_run_quote'
  | 'prompt_logging_enabled'
  | 'completion_logging_enabled'
  | 'training_use_enabled';

export interface TokenServiceCardVerificationResult {
  valid: boolean;
  codes: TokenServiceCardVerificationCode[];
  warnings: TokenServiceCardVerificationCode[];
  expected_card_id?: string;
  expected_body_hash?: string;
}

export type MeteredEscrowContractStatus =
  | 'accepted'
  | 'funded'
  | 'active'
  | 'exhausted'
  | 'completed'
  | 'refunded'
  | 'disputed'
  | 'resolved'
  | 'expired';

export interface MeteredUsageEvent {
  schema: 'satonomous.token-usage-event/v0';
  event_id: string;
  request_id: string;
  contract_id: string;
  created_at: string;
  model_id: string;
  input_tokens: number;
  output_tokens: number;
  cached_input_tokens?: number;
  sats_charged: number;
  metering_source: TokenServiceMeteringMethod | 'gateway';
  seller_signature?: string;
  seller_public_key_pem?: string;
  buyer_acknowledged?: boolean;
  prompt_hash?: string;
  completion_hash?: string;
  metadata_hash?: string;
}

export interface MeteredEscrowContract {
  schema: 'satonomous.metered-escrow-contract/v0';
  contract_id: string;
  terms_hash: string;
  body_hash: string;
  issued_at: string;
  updated_at: string;
  token_service_card_id: string;
  token_service_card_hash: string;
  buyer_agent_id: string;
  seller_agent_id: string;
  status: MeteredEscrowContractStatus;
  pricing: Pick<
    TokenServiceCard['pricing'],
    'currency' | 'unit' | 'input_sats' | 'output_sats' | 'cached_input_sats' | 'request_minimum_sats' | 'max_contract_sats'
  >;
  limits: Pick<
    TokenServiceCard['limits'],
    'max_context_tokens' | 'max_output_tokens' | 'max_requests_per_contract' | 'expires_after_minutes'
  > & {
    expires_at: string | null;
  };
  metering: Pick<TokenServiceCard['metering'], 'method' | 'token_counter' | 'idempotency'>;
  escrow: {
    escrowed_sats: number;
    spent_sats: number;
    refundable_sats: number;
    settled_sats: number;
    disputed_sats: number;
  };
  settlement: Pick<TokenServiceCard['settlement'], 'dispute_window_minutes' | 'refund_unused_sats' | 'partial_settlement'>;
  usage_events: MeteredUsageEvent[];
  links?: {
    token_service_card?: string;
    receipt?: string;
    [key: string]: string | undefined;
  };
}

export interface CreateMeteredEscrowContractOptions {
  issuedAt?: string;
  updatedAt?: string;
  expiresAt?: string | null;
  tokenServiceCard: TokenServiceCard;
  buyerAgentId: string;
  escrowedSats: number;
  status?: Extract<MeteredEscrowContractStatus, 'accepted' | 'funded' | 'active'>;
  links?: MeteredEscrowContract['links'];
}

export interface MeteredUsageInput {
  requestId: string;
  createdAt?: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  meteringSource?: MeteredUsageEvent['metering_source'];
  sellerSignature?: string;
  sellerPublicKeyPem?: string;
  buyerAcknowledged?: boolean;
  promptHash?: string;
  completionHash?: string;
  metadataHash?: string;
}

export type MeteredEscrowVerificationCode =
  | 'valid'
  | 'unsupported_schema'
  | 'missing_contract_id'
  | 'missing_terms_hash'
  | 'missing_body_hash'
  | 'terms_hash_mismatch'
  | 'body_hash_mismatch'
  | 'contract_id_mismatch'
  | 'missing_token_service_card_ref'
  | 'invalid_status'
  | 'invalid_price'
  | 'invalid_escrow_amount'
  | 'spend_exceeds_escrow'
  | 'usage_sum_mismatch'
  | 'refund_math_mismatch'
  | 'duplicate_request_id'
  | 'invalid_usage_event'
  | 'invalid_expiry';

export interface MeteredEscrowVerificationResult {
  valid: boolean;
  codes: MeteredEscrowVerificationCode[];
  expected_contract_id?: string;
  expected_terms_hash?: string;
  expected_body_hash?: string;
}

export interface MeteredUsageQuote {
  input_sats: number;
  output_sats: number;
  cached_input_sats: number;
  minimum_applied_sats: number;
  total_sats: number;
  remaining_before_sats: number;
  remaining_after_sats: number;
}

export type MeteredUsageApplyCode =
  | 'applied'
  | 'contract_not_spendable'
  | 'invalid_usage'
  | 'unknown_model'
  | 'usage_exceeds_limits'
  | 'request_limit_exceeded'
  | 'duplicate_request_id'
  | 'insufficient_escrow'
  | 'missing_signature'
  | 'missing_public_key'
  | 'invalid_signature';

export interface MeteredUsageApplyResult {
  applied: boolean;
  codes: MeteredUsageApplyCode[];
  reasons: string[];
  quote?: MeteredUsageQuote;
  event?: MeteredUsageEvent;
  contract: MeteredEscrowContract;
}

export type ContractReceiptOutcome = 'released' | 'disputed' | 'refunded';

export interface ContractReceiptEvidenceRef {
  kind: 'delivery' | 'dispute' | 'redacted' | 'verifier' | 'hash' | 'external';
  uri?: string;
  hash?: string;
  submitted_by?: string;
  submitted_at?: string;
  redaction_status?: 'none' | 'redacted' | 'private';
  note?: string;
}

export interface ContractReceipt {
  schema: 'satonomous.contract-receipt/v0';
  receipt_id: string;
  body_hash: string;
  issued_at: string;
  contract: {
    id: string;
    offer_id: string;
    service_type: string | null;
    buyer_agent_id: string;
    seller_agent_id: string;
    price_sats: number;
    fee_sats: number;
    settlement_rail: 'lightning';
    status: string;
  };
  terms: {
    title: string | null;
    description: string | null;
    sla_minutes: number | null;
    dispute_window_minutes: number | null;
    [key: string]: any;
  };
  delivery_proof: {
    url: string | null;
    payload_hash: string | null;
    submitted_at: string | null;
  };
  evidence_refs: ContractReceiptEvidenceRef[];
  settlement: {
    outcome: ContractReceiptOutcome;
    released_at: string | null;
    disputed_at: string | null;
    refunded_at: string | null;
    ledger_reference_ids: string[];
  };
  reputation_event: {
    seller_effect: 'completed_contract' | 'disputed_contract' | 'refunded_contract';
    buyer_effect: 'released_contract' | 'disputed_contract' | 'refunded_contract';
    counts_toward_reputation: boolean;
  };
  links?: {
    quickstart?: string;
    contract?: string;
    [key: string]: string | undefined;
  };
}

export interface CreateContractReceiptOptions {
  issuedAt?: string;
  evidenceRefs?: ContractReceiptEvidenceRef[];
  refundedAt?: string | null;
  links?: ContractReceipt['links'];
}

export type ContractReceiptVerificationCode =
  | 'valid'
  | 'unsupported_schema'
  | 'missing_receipt_id'
  | 'missing_body_hash'
  | 'body_hash_mismatch'
  | 'receipt_id_mismatch'
  | 'non_terminal_contract_status'
  | 'missing_delivery_proof'
  | 'missing_settlement_outcome'
  | 'missing_ledger_reference'
  | 'invalid_evidence_ref';

export interface ContractReceiptVerificationResult {
  valid: boolean;
  codes: ContractReceiptVerificationCode[];
  warnings: ContractReceiptVerificationCode[];
  expected_receipt_id?: string;
  expected_body_hash?: string;
}

export interface FundResult {
  success: boolean;
  contract: Contract;
  message: string;
}

export interface DepositInvoice {
  payment_hash: string;
  invoice: string;
  amount_sats: number;
  /**
   * The human-readable message explaining what to do with this invoice.
   * Agents should forward this + the invoice to a human for payment.
   */
  message: string;
  /**
   * Ready-to-click `lightning:` URI. Paste into any Lightning wallet
   * or click from a phone to open the wallet app directly.
   *
   * Example: `lightning:lnbc10u1p5ul...`
   */
  pay_url: string;
}

/**
 * Callback for notifying a human that payment is needed.
 * AI agents cannot pay Lightning invoices on their own — they need a human
 * (or an external wallet) to pay. This callback is how the agent asks for help.
 *
 * @example
 * // Slack/Discord/Signal notification
 * const agent = new L402Agent({
 *   apiKey: 'sk_...',
 *   onPaymentNeeded: async (invoice) => {
 *     await sendMessage(channel, [
 *       `⚡ Payment needed: ${invoice.amount_sats} sats`,
 *       `Invoice: ${invoice.invoice}`,
 *       `Reason: ${invoice.message}`,
 *     ].join('\n'));
 *   },
 * });
 */
export type PaymentNeededCallback = (invoice: DepositInvoice) => Promise<void> | void;

export interface DepositStatus {
  status: 'pending' | 'paid' | 'expired';
  amount_sats: number;
  paid_at: string | null;
}

export interface LedgerEntry {
  id: number;
  type: 'credit' | 'debit';
  amount_sats: number;
  source: string;
  reference_id: string | null;
  balance_after: number;
  created_at: string;
}

export interface WithdrawResult {
  lnurl: string;
  qr_data: string;
  k1: string;
  amount_sats: number;
  balance_sats: number;
}

export interface AgentRegistration {
  tenant_id: string;
  api_key: string;
  name: string;
  description: string | null;
  wallet_type: string;
  lightning_address: string | null;
  balance_sats: number;
}
