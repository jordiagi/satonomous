interface L402AgentOptions {
    apiKey: string;
    apiUrl?: string;
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
interface BalanceInfo {
    balance_sats: number;
}
interface Offer {
    id: string;
    seller_tenant_id: string;
    service_type: string;
    title: string;
    description: string | null;
    terms: {
        sla_minutes?: number;
        dispute_window_minutes?: number;
        [key: string]: any;
    };
    price_sats: number;
    max_concurrent_contracts: number;
    active: number;
    created_at: string;
    expires_at: string | null;
    seller_reputation?: OfferSellerReputation;
}
type ReputationLevel = 'new' | 'bronze' | 'silver' | 'gold' | 'platinum';
type OfferSort = 'created_at' | 'price' | 'reputation';
interface OfferSellerReputation {
    score: number;
    level: ReputationLevel;
    completed_contracts: number;
    settled_contracts: number;
    dispute_rate: number;
    total_volume_sats: number;
    unique_counterparties: number;
}
interface ListOffersParams {
    service_type?: string;
    min_reputation?: number;
    hide_unrated?: boolean;
    sort?: OfferSort;
    limit?: number;
    offset?: number;
}
interface SellerReputationSummary {
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
interface BuyerReputationSummary {
    settled_contracts: number;
    funded_contracts: number;
    released_contracts: number;
    disputes_opened: number;
    buyer_lost_disputes: number;
    dispute_rate: number;
    total_volume_sats: number;
    unique_counterparties: number;
}
interface RoleReputation<TSummary> {
    tenant_id: string;
    role: 'seller' | 'buyer';
    score: number;
    level: ReputationLevel;
    summary: TSummary;
    last_updated_at: string;
}
interface TenantReputation {
    tenant_id: string;
    seller: RoleReputation<SellerReputationSummary>;
    buyer: RoleReputation<BuyerReputationSummary>;
}
interface TenantInfo {
    tenant_id: string;
    email: string;
    site_url: string | null;
    fee_pct: number;
    balance_sats: number;
    email_verified: boolean;
    created_at: string;
    enabled: boolean;
}
interface CreateOfferParams {
    title: string;
    description?: string;
    price_sats: number;
    service_type: string;
    sla_minutes?: number;
    dispute_window_minutes?: number;
}
interface Contract {
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
interface WalletPolicy {
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
interface CreateWalletPolicyOptions {
    issuedAt?: string;
    agentId?: string;
    limits?: WalletPolicy['limits'];
    approvals?: WalletPolicy['approvals'];
    allowlists?: WalletPolicy['allowlists'];
    denylists?: WalletPolicy['denylists'];
    expiresAt?: string | null;
    notes?: string;
}
type WalletPolicyVerificationCode = 'valid' | 'unsupported_schema' | 'missing_policy_id' | 'missing_body_hash' | 'body_hash_mismatch' | 'policy_id_mismatch' | 'invalid_limit' | 'invalid_reputation_threshold';
interface WalletPolicyVerificationResult {
    valid: boolean;
    codes: WalletPolicyVerificationCode[];
    expected_policy_id?: string;
    expected_body_hash?: string;
}
interface WalletPolicySpendRequest {
    amount_sats: number;
    price_sats?: number;
    fee_sats?: number;
    counterparty_tenant_id?: string;
    service_type?: string | null;
    offer_id?: string;
    contract_id?: string;
    description?: string;
}
interface WalletPolicyContext {
    daily_spent_sats?: number;
    counterparty_spent_sats?: number;
    seller_reputation_score?: number | null;
    now?: string;
}
type WalletPolicyDecisionKind = 'allow' | 'deny' | 'ask_human';
type WalletPolicyDecisionCode = 'allowed' | 'invalid_policy' | 'deny_policy_expired' | 'deny_amount_exceeds_contract_price_limit' | 'deny_amount_exceeds_contract_total_limit' | 'deny_daily_spend_limit' | 'deny_counterparty_spend_limit' | 'deny_counterparty_denied' | 'deny_counterparty_not_allowed' | 'deny_service_type_denied' | 'deny_service_type_not_allowed' | 'deny_min_seller_reputation' | 'ask_human_amount_above_threshold' | 'ask_human_unrated_counterparty';
interface WalletPolicyDecision {
    decision: WalletPolicyDecisionKind;
    codes: WalletPolicyDecisionCode[];
    reasons: string[];
    amount_sats: number;
    policy_id: string;
}
interface FundContractPolicyOptions {
    policy?: WalletPolicy;
    context?: WalletPolicyContext;
    humanApproved?: boolean;
}
type ContractRole = 'buyer' | 'seller' | 'observer';
type ContractNextActionCode = 'fund_contract' | 'wait_for_funding' | 'submit_delivery' | 'wait_for_delivery' | 'confirm_or_dispute_delivery' | 'wait_for_buyer_review' | 'review_dispute' | 'terminal_receipt_available' | 'unknown_status';
interface ContractNextAction {
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
interface ContractActionOptions {
    role?: ContractRole;
    now?: string;
}
interface WaitForContractActionOptions extends ContractActionOptions {
    action?: ContractNextActionCode;
    status?: string;
    timeoutMs?: number;
    pollIntervalMs?: number;
}
interface ServiceCardSellerReputation {
    score: number;
    level: ReputationLevel;
    settled_contracts: number;
    dispute_rate: number;
    total_volume_sats: number;
    unique_counterparties: number;
}
interface ServiceCard {
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
interface CreateServiceCardOptions {
    issuedAt?: string;
    acceptUrl?: string;
    contractTemplateRef?: string;
    proofRequirements?: string[];
    links?: ServiceCard['links'];
}
type ServiceCardVerificationCode = 'valid' | 'unsupported_schema' | 'missing_card_id' | 'missing_body_hash' | 'body_hash_mismatch' | 'card_id_mismatch' | 'inactive_offer' | 'missing_accept_url' | 'missing_price' | 'missing_sla' | 'invalid_reputation';
interface ServiceCardVerificationResult {
    valid: boolean;
    codes: ServiceCardVerificationCode[];
    warnings: ServiceCardVerificationCode[];
    expected_card_id?: string;
    expected_body_hash?: string;
}
type TokenServiceProviderType = 'local' | 'hosted' | 'byok' | 'brokered' | 'aggregator' | 'unknown';
type TokenServiceProviderDisclosure = 'exact' | 'class' | 'undisclosed';
type TokenServiceAuthorizationBasis = 'own_infrastructure' | 'authorized_resale' | 'aggregator_terms' | 'unknown' | 'prohibited_risk';
type TokenServicePricingUnit = 'per_1k_tokens' | 'per_1m_tokens';
type TokenServiceMeteringMethod = 'seller_signed_usage' | 'gateway_verified' | 'buyer_acknowledged';
type TokenServiceRetentionMode = 'none' | 'hash_only' | 'redacted' | 'full' | 'custom';
interface TokenServiceModel {
    id: string;
    display_name?: string;
    max_context_tokens?: number;
    max_output_tokens?: number;
    modalities?: Array<'text' | 'vision' | 'audio' | 'embedding' | 'tool_call'>;
}
interface TokenServiceCard {
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
interface CreateTokenServiceCardOptions {
    issuedAt?: string;
    seller: TokenServiceCard['seller'];
    service: TokenServiceCard['service'];
    inference: TokenServiceCard['inference'];
    pricing: TokenServiceCard['pricing'];
    limits: TokenServiceCard['limits'];
    metering: Omit<TokenServiceCard['metering'], 'usage_receipt_schema' | 'idempotency'> & Partial<Pick<TokenServiceCard['metering'], 'usage_receipt_schema' | 'idempotency'>>;
    privacy: TokenServiceCard['privacy'];
    settlement: Omit<TokenServiceCard['settlement'], 'escrow_policy' | 'settlement_policy'> & Partial<Pick<TokenServiceCard['settlement'], 'escrow_policy' | 'settlement_policy'>>;
    accept: TokenServiceCard['accept'];
    links?: TokenServiceCard['links'];
}
type TokenServiceCardVerificationCode = 'valid' | 'unsupported_schema' | 'missing_card_id' | 'missing_body_hash' | 'body_hash_mismatch' | 'card_id_mismatch' | 'inactive_service' | 'missing_accept_url' | 'missing_model' | 'missing_pricing' | 'invalid_price' | 'missing_budget_cap' | 'invalid_limit' | 'missing_metering' | 'missing_authorization_attestation' | 'prohibited_resale_risk' | 'raw_credential_resale' | 'undisclosed_provider' | 'unknown_resale_rights' | 'missing_sla' | 'missing_reputation' | 'no_dry_run_quote' | 'prompt_logging_enabled' | 'completion_logging_enabled' | 'training_use_enabled';
interface TokenServiceCardVerificationResult {
    valid: boolean;
    codes: TokenServiceCardVerificationCode[];
    warnings: TokenServiceCardVerificationCode[];
    expected_card_id?: string;
    expected_body_hash?: string;
}
type MeteredEscrowContractStatus = 'accepted' | 'funded' | 'active' | 'exhausted' | 'completed' | 'refunded' | 'disputed' | 'resolved' | 'expired';
interface MeteredUsageEvent {
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
    buyer_acknowledged?: boolean;
    prompt_hash?: string;
    completion_hash?: string;
    metadata_hash?: string;
}
interface MeteredEscrowContract {
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
    pricing: Pick<TokenServiceCard['pricing'], 'currency' | 'unit' | 'input_sats' | 'output_sats' | 'cached_input_sats' | 'request_minimum_sats' | 'max_contract_sats'>;
    limits: Pick<TokenServiceCard['limits'], 'max_context_tokens' | 'max_output_tokens' | 'max_requests_per_contract' | 'expires_after_minutes'> & {
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
interface CreateMeteredEscrowContractOptions {
    issuedAt?: string;
    updatedAt?: string;
    expiresAt?: string | null;
    tokenServiceCard: TokenServiceCard;
    buyerAgentId: string;
    escrowedSats: number;
    status?: Extract<MeteredEscrowContractStatus, 'accepted' | 'funded' | 'active'>;
    links?: MeteredEscrowContract['links'];
}
interface MeteredUsageInput {
    requestId: string;
    createdAt?: string;
    modelId: string;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens?: number;
    meteringSource?: MeteredUsageEvent['metering_source'];
    sellerSignature?: string;
    buyerAcknowledged?: boolean;
    promptHash?: string;
    completionHash?: string;
    metadataHash?: string;
}
type MeteredEscrowVerificationCode = 'valid' | 'unsupported_schema' | 'missing_contract_id' | 'missing_terms_hash' | 'missing_body_hash' | 'terms_hash_mismatch' | 'body_hash_mismatch' | 'contract_id_mismatch' | 'missing_token_service_card_ref' | 'invalid_status' | 'invalid_price' | 'invalid_escrow_amount' | 'spend_exceeds_escrow' | 'usage_sum_mismatch' | 'refund_math_mismatch' | 'duplicate_request_id' | 'invalid_usage_event' | 'invalid_expiry';
interface MeteredEscrowVerificationResult {
    valid: boolean;
    codes: MeteredEscrowVerificationCode[];
    expected_contract_id?: string;
    expected_terms_hash?: string;
    expected_body_hash?: string;
}
interface MeteredUsageQuote {
    input_sats: number;
    output_sats: number;
    cached_input_sats: number;
    minimum_applied_sats: number;
    total_sats: number;
    remaining_before_sats: number;
    remaining_after_sats: number;
}
type MeteredUsageApplyCode = 'applied' | 'contract_not_spendable' | 'invalid_usage' | 'unknown_model' | 'usage_exceeds_limits' | 'request_limit_exceeded' | 'duplicate_request_id' | 'insufficient_escrow';
interface MeteredUsageApplyResult {
    applied: boolean;
    codes: MeteredUsageApplyCode[];
    reasons: string[];
    quote?: MeteredUsageQuote;
    event?: MeteredUsageEvent;
    contract: MeteredEscrowContract;
}
type ContractReceiptOutcome = 'released' | 'disputed' | 'refunded';
interface ContractReceiptEvidenceRef {
    kind: 'delivery' | 'dispute' | 'redacted' | 'verifier' | 'hash' | 'external';
    uri?: string;
    hash?: string;
    submitted_by?: string;
    submitted_at?: string;
    redaction_status?: 'none' | 'redacted' | 'private';
    note?: string;
}
interface ContractReceipt {
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
interface CreateContractReceiptOptions {
    issuedAt?: string;
    evidenceRefs?: ContractReceiptEvidenceRef[];
    refundedAt?: string | null;
    links?: ContractReceipt['links'];
}
type ContractReceiptVerificationCode = 'valid' | 'unsupported_schema' | 'missing_receipt_id' | 'missing_body_hash' | 'body_hash_mismatch' | 'receipt_id_mismatch' | 'non_terminal_contract_status' | 'missing_delivery_proof' | 'missing_settlement_outcome' | 'missing_ledger_reference' | 'invalid_evidence_ref';
interface ContractReceiptVerificationResult {
    valid: boolean;
    codes: ContractReceiptVerificationCode[];
    warnings: ContractReceiptVerificationCode[];
    expected_receipt_id?: string;
    expected_body_hash?: string;
}
interface FundResult {
    success: boolean;
    contract: Contract;
    message: string;
}
interface DepositInvoice {
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
type PaymentNeededCallback = (invoice: DepositInvoice) => Promise<void> | void;
interface DepositStatus {
    status: 'pending' | 'paid' | 'expired';
    amount_sats: number;
    paid_at: string | null;
}
interface LedgerEntry {
    id: number;
    type: 'credit' | 'debit';
    amount_sats: number;
    source: string;
    reference_id: string | null;
    balance_after: number;
    created_at: string;
}
interface WithdrawResult {
    lnurl: string;
    qr_data: string;
    k1: string;
    amount_sats: number;
    balance_sats: number;
}
interface AgentRegistration {
    tenant_id: string;
    api_key: string;
    name: string;
    description: string | null;
    wallet_type: string;
    lightning_address: string | null;
    balance_sats: number;
}

declare class L402Error extends Error {
    status: number;
    code?: string;
    constructor(message: string, status: number, code?: string);
}
declare class L402Agent {
    private apiKey;
    private apiUrl;
    private onPaymentNeeded?;
    private paymentTimeoutMs;
    private paymentPollIntervalMs;
    private walletPolicy?;
    private onPolicyApprovalNeeded?;
    constructor(options: L402AgentOptions);
    private request;
    private buildQuery;
    static register(options: {
        name: string;
        description?: string;
        wallet_type?: 'custodial' | 'external';
        lightning_address?: string;
        apiUrl?: string;
    }): Promise<AgentRegistration>;
    getBalance(): Promise<BalanceInfo>;
    /**
     * Low-level: create a deposit invoice. Returns the invoice for manual handling.
     * Most agents should use `deposit()` instead, which notifies the human and waits.
     */
    createDeposit(amount_sats: number): Promise<DepositInvoice>;
    /**
     * Check if a deposit invoice has been paid.
     */
    checkDeposit(paymentHash: string): Promise<DepositStatus>;
    /**
     * High-level deposit: creates invoice, notifies human, waits for payment.
     *
     * WHY THIS EXISTS: AI agents don't have Lightning wallets. They can't pay
     * invoices. When an agent needs sats, it must ask a human to pay.
     *
     * This method:
     * 1. Creates a Lightning invoice for the requested amount
     * 2. Calls `onPaymentNeeded` so you can notify the human (chat, email, UI)
     * 3. Polls until the invoice is paid or times out
     * 4. Returns the confirmed deposit status
     *
     * If `onPaymentNeeded` is not configured, throws with the invoice so the
     * caller can handle notification manually.
     *
     * @param amount_sats - Amount to deposit
     * @param reason - Human-readable reason (shown in the notification)
     * @returns Confirmed deposit status
     * @throws {L402Error} if payment times out or fails
     *
     * @example
     * const agent = new L402Agent({
     *   apiKey: 'sk_...',
     *   onPaymentNeeded: async (invoice) => {
     *     // Send to Slack, Discord, Signal, email, etc.
     *     await notify(`Pay ${invoice.amount_sats} sats: ${invoice.invoice}`);
     *   },
     * });
     *
     * // Agent requests funding and waits
     * const deposit = await agent.deposit(1000, 'Need funds to accept code-review offer');
     * console.log(`Funded! Balance: ${deposit.amount_sats} sats`);
     */
    deposit(amount_sats: number, reason?: string): Promise<DepositStatus>;
    /**
     * Ensure the agent has at least `minBalance` sats. If not, request a deposit.
     * Convenience method that checks balance first, then deposits the difference.
     *
     * @example
     * // Before accepting an offer, make sure you can pay
     * await agent.ensureBalance(500, 'Need funds for code-review contract');
     * await agent.fundContract(contractId);
     */
    ensureBalance(minBalance: number, reason?: string): Promise<BalanceInfo>;
    withdraw(amount_sats?: number): Promise<WithdrawResult>;
    createOffer(params: CreateOfferParams): Promise<Offer>;
    getTenant(): Promise<TenantInfo>;
    getReputation(tenantId?: string): Promise<TenantReputation>;
    listOffers(filters?: ListOffersParams): Promise<Offer[]>;
    browseOffers(filters?: ListOffersParams): Promise<Offer[]>;
    getOffer(offerId: string): Promise<Offer>;
    getServiceCard(offerId: string, options?: CreateServiceCardOptions): Promise<ServiceCard>;
    browseServiceCards(filters?: ListOffersParams, options?: CreateServiceCardOptions): Promise<ServiceCard[]>;
    verifyServiceCard(card: ServiceCard): ServiceCardVerificationResult;
    updateOffer(offerId: string, active: boolean): Promise<Offer>;
    acceptOffer(offerId: string): Promise<Contract>;
    fundContract(contractId: string, options?: FundContractPolicyOptions): Promise<FundResult>;
    listContracts(filters?: {
        role?: 'buyer' | 'seller';
        status?: string;
    }): Promise<Contract[]>;
    getContract(contractId: string): Promise<Contract>;
    private inferRole;
    getContractNextAction(contractId: string, options?: ContractActionOptions): Promise<ContractNextAction>;
    listContractActions(filters?: {
        role?: 'buyer' | 'seller';
        status?: string;
    }, options?: ContractActionOptions): Promise<ContractNextAction[]>;
    waitForContractAction(contractId: string, options?: WaitForContractActionOptions): Promise<ContractNextAction>;
    evaluateWalletPolicy(policy: WalletPolicy, request: WalletPolicySpendRequest, context?: WalletPolicyContext): WalletPolicyDecision;
    evaluateContractFunding(contractId: string, options?: FundContractPolicyOptions): Promise<WalletPolicyDecision>;
    submitDelivery(contractId: string, proofUrl: string, proofData?: any): Promise<Contract>;
    confirmDelivery(contractId: string): Promise<Contract>;
    disputeDelivery(contractId: string, reason: string, evidenceUrl?: string): Promise<Contract>;
    getLedger(limit?: number, offset?: number): Promise<{
        balance_sats: number;
        entries: LedgerEntry[];
    }>;
    getContractReceipt(contractId: string): Promise<ContractReceipt>;
    verifyContractReceipt(receipt: ContractReceipt): ContractReceiptVerificationResult;
}

declare function createContractReceipt(contract: Contract, ledgerEntries?: LedgerEntry[], options?: CreateContractReceiptOptions): ContractReceipt;
declare function verifyContractReceipt(receipt: ContractReceipt): ContractReceiptVerificationResult;

declare function createServiceCard(offer: Offer, reputation?: TenantReputation | null, options?: CreateServiceCardOptions): ServiceCard;
declare function verifyServiceCard(card: ServiceCard): ServiceCardVerificationResult;

declare function createTokenServiceCard(options: CreateTokenServiceCardOptions): TokenServiceCard;
declare function verifyTokenServiceCard(card: TokenServiceCard): TokenServiceCardVerificationResult;

declare function createMeteredEscrowContract(options: CreateMeteredEscrowContractOptions): MeteredEscrowContract;
declare function quoteMeteredUsage(contract: MeteredEscrowContract, usage: MeteredUsageInput): MeteredUsageQuote;
declare function applyMeteredUsage(contract: MeteredEscrowContract, usage: MeteredUsageInput): MeteredUsageApplyResult;
declare function closeMeteredEscrowContract(contract: MeteredEscrowContract, status?: Extract<MeteredEscrowContractStatus, 'completed' | 'refunded' | 'disputed' | 'expired'>, closedAt?: string): MeteredEscrowContract;
declare function verifyMeteredEscrowContract(contract: MeteredEscrowContract): MeteredEscrowVerificationResult;

declare function createWalletPolicy(options?: CreateWalletPolicyOptions): WalletPolicy;
declare function verifyWalletPolicy(policy: WalletPolicy): WalletPolicyVerificationResult;
declare function evaluateWalletPolicy(policy: WalletPolicy, request: WalletPolicySpendRequest, context?: WalletPolicyContext): WalletPolicyDecision;

declare function getContractNextAction(contract: Contract, options?: ContractActionOptions): ContractNextAction;

export { type AgentRegistration, type BalanceInfo, type BuyerReputationSummary, type Contract, type ContractActionOptions, type ContractNextAction, type ContractNextActionCode, type ContractReceipt, type ContractReceiptEvidenceRef, type ContractReceiptOutcome, type ContractReceiptVerificationCode, type ContractReceiptVerificationResult, type ContractRole, type CreateContractReceiptOptions, type CreateMeteredEscrowContractOptions, type CreateOfferParams, type CreateServiceCardOptions, type CreateTokenServiceCardOptions, type CreateWalletPolicyOptions, type DepositInvoice, type DepositStatus, type FundContractPolicyOptions, type FundResult, L402Agent, type L402AgentOptions, L402Error, type LedgerEntry, type ListOffersParams, type MeteredEscrowContract, type MeteredEscrowContractStatus, type MeteredEscrowVerificationCode, type MeteredEscrowVerificationResult, type MeteredUsageApplyCode, type MeteredUsageApplyResult, type MeteredUsageEvent, type MeteredUsageInput, type MeteredUsageQuote, type Offer, type OfferSellerReputation, type OfferSort, type PaymentNeededCallback, type ReputationLevel, type RoleReputation, type SellerReputationSummary, type ServiceCard, type ServiceCardSellerReputation, type ServiceCardVerificationCode, type ServiceCardVerificationResult, type TenantInfo, type TenantReputation, type TokenServiceAuthorizationBasis, type TokenServiceCard, type TokenServiceCardVerificationCode, type TokenServiceCardVerificationResult, type TokenServiceMeteringMethod, type TokenServiceModel, type TokenServicePricingUnit, type TokenServiceProviderDisclosure, type TokenServiceProviderType, type TokenServiceRetentionMode, type WaitForContractActionOptions, type WalletPolicy, type WalletPolicyContext, type WalletPolicyDecision, type WalletPolicyDecisionCode, type WalletPolicyDecisionKind, type WalletPolicySpendRequest, type WalletPolicyVerificationCode, type WalletPolicyVerificationResult, type WithdrawResult, applyMeteredUsage, closeMeteredEscrowContract, createContractReceipt, createMeteredEscrowContract, createServiceCard, createTokenServiceCard, createWalletPolicy, evaluateWalletPolicy, getContractNextAction, quoteMeteredUsage, verifyContractReceipt, verifyMeteredEscrowContract, verifyServiceCard, verifyTokenServiceCard, verifyWalletPolicy };
