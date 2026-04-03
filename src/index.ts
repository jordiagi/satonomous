/**
 * satonomous — SDK for autonomous AI agents to earn and spend sats
 *
 * AI agents can't pay Lightning invoices — they don't have wallets.
 * This SDK bridges that gap: when an agent needs funds, it notifies
 * a human (via callback) and waits for payment.
 *
 * @example
 * ```ts
 * import { L402Agent } from 'satonomous';
 *
 * const agent = new L402Agent({
 *   apiKey: 'sk_...',
 *   // This is the key part: how the agent asks a human for money
 *   onPaymentNeeded: async (invoice) => {
 *     await sendSlackMessage(`⚡ Pay ${invoice.amount_sats} sats: ${invoice.invoice}`);
 *   },
 * });
 *
 * // Agent ensures it has funds before working
 * await agent.ensureBalance(500, 'Need funds for code-review contract');
 * ```
 *
 * @module
 */

export { L402Agent, L402Error } from './client.js';
export type {
  L402AgentOptions,
  BalanceInfo,
  Offer,
  CreateOfferParams,
  Contract,
  FundResult,
  DepositInvoice,
  DepositStatus,
  LedgerEntry,
  WithdrawResult,
  AgentRegistration,
  PaymentNeededCallback,
} from './types.js';
