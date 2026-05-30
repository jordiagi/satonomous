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
export { createContractReceipt, verifyContractReceipt } from './receipts.js';
export { createServiceCard, verifyServiceCard } from './service-cards.js';
export { createTokenServiceCard, verifyTokenServiceCard } from './token-service-cards.js';
export {
  applyMeteredUsage,
  closeMeteredEscrowContract,
  createMeteredEscrowContract,
  quoteMeteredUsage,
  verifyMeteredEscrowContract,
} from './metered-escrow-contracts.js';
export { createWalletPolicy, evaluateWalletPolicy, verifyWalletPolicy } from './wallet-policies.js';
export { getContractNextAction } from './contract-actions.js';
export type {
  L402AgentOptions,
  BalanceInfo,
  Offer,
  OfferSellerReputation,
  ListOffersParams,
  OfferSort,
  CreateOfferParams,
  Contract,
  FundResult,
  DepositInvoice,
  DepositStatus,
  LedgerEntry,
  WithdrawResult,
  AgentRegistration,
  TenantInfo,
  TenantReputation,
  RoleReputation,
  SellerReputationSummary,
  BuyerReputationSummary,
  ReputationLevel,
  PaymentNeededCallback,
  ContractReceipt,
  ContractReceiptEvidenceRef,
  ContractReceiptOutcome,
  ContractReceiptVerificationCode,
  ContractReceiptVerificationResult,
  CreateContractReceiptOptions,
  ServiceCard,
  ServiceCardSellerReputation,
  ServiceCardVerificationCode,
  ServiceCardVerificationResult,
  CreateServiceCardOptions,
  TokenServiceProviderType,
  TokenServiceProviderDisclosure,
  TokenServiceAuthorizationBasis,
  TokenServicePricingUnit,
  TokenServiceMeteringMethod,
  TokenServiceRetentionMode,
  TokenServiceModel,
  TokenServiceCard,
  CreateTokenServiceCardOptions,
  TokenServiceCardVerificationCode,
  TokenServiceCardVerificationResult,
  MeteredEscrowContractStatus,
  MeteredUsageEvent,
  MeteredEscrowContract,
  CreateMeteredEscrowContractOptions,
  MeteredUsageInput,
  MeteredEscrowVerificationCode,
  MeteredEscrowVerificationResult,
  MeteredUsageQuote,
  MeteredUsageApplyCode,
  MeteredUsageApplyResult,
  WalletPolicy,
  CreateWalletPolicyOptions,
  WalletPolicyVerificationCode,
  WalletPolicyVerificationResult,
  WalletPolicySpendRequest,
  WalletPolicyContext,
  WalletPolicyDecisionKind,
  WalletPolicyDecisionCode,
  WalletPolicyDecision,
  FundContractPolicyOptions,
  ContractRole,
  ContractNextActionCode,
  ContractNextAction,
  ContractActionOptions,
  WaitForContractActionOptions,
} from './types.js';
