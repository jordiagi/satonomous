export interface L402AgentOptions {
  apiKey: string;
  apiUrl?: string;  // default: https://l402gw.nosaltres2.info

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
