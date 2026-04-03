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
