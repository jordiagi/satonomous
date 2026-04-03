import type {
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

export class L402Error extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'L402Error';
    this.status = status;
    this.code = code;
  }
}

export class L402Agent {
  private apiKey: string;
  private apiUrl: string;

  private onPaymentNeeded?: PaymentNeededCallback;
  private paymentTimeoutMs: number;
  private paymentPollIntervalMs: number;

  constructor(options: L402AgentOptions) {
    if (!options.apiKey) {
      throw new Error('apiKey is required');
    }
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl ?? 'https://l402gw.nosaltres2.info';
    this.onPaymentNeeded = options.onPaymentNeeded;
    this.paymentTimeoutMs = options.paymentTimeoutMs ?? 300_000;
    this.paymentPollIntervalMs = options.paymentPollIntervalMs ?? 5_000;
  }

  private async request<T>(method: string, path: string, body?: any): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const options: RequestInit = {
      method,
      headers: {
        'X-L402-Key': this.apiKey,
        'Content-Type': 'application/json',
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      let errorCode: string | undefined;

      try {
        const data = await res.json() as { error?: string; code?: string };
        errorMsg = data.error || errorMsg;
        errorCode = data.code;
      } catch {
        // Use default error message
      }

      throw new L402Error(errorMsg, res.status, errorCode);
    }

    return res.json() as Promise<T>;
  }

  // Static: register a new agent (no auth needed)
  static async register(options: {
    name: string;
    description?: string;
    wallet_type?: 'custodial' | 'external';
    lightning_address?: string;
    apiUrl?: string;
  }): Promise<AgentRegistration> {
    const apiUrl = options.apiUrl ?? 'https://l402gw.nosaltres2.info';
    const url = `${apiUrl}/api/v1/agents/register`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: options.name,
        description: options.description,
        wallet_type: options.wallet_type ?? 'custodial',
        lightning_address: options.lightning_address,
      }),
    });

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const data = await res.json() as { error?: string };
        errorMsg = data.error || errorMsg;
      } catch {
        // Use default error message
      }
      throw new L402Error(errorMsg, res.status);
    }

    return res.json() as Promise<AgentRegistration>;
  }

  // Wallet
  async getBalance(): Promise<BalanceInfo> {
    return this.request('GET', '/api/v1/wallet/balance');
  }

  /**
   * Low-level: create a deposit invoice. Returns the invoice for manual handling.
   * Most agents should use `deposit()` instead, which notifies the human and waits.
   */
  async createDeposit(amount_sats: number): Promise<DepositInvoice> {
    const result = await this.request<DepositInvoice>('POST', '/api/v1/wallet/deposit', { amount_sats });
    // Add pay_url for easy wallet linking
    return {
      ...result,
      pay_url: `lightning:${result.invoice}`,
    };
  }

  /**
   * Check if a deposit invoice has been paid.
   */
  async checkDeposit(paymentHash: string): Promise<DepositStatus> {
    return this.request('GET', `/api/v1/wallet/deposit/${paymentHash}`);
  }

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
  async deposit(amount_sats: number, reason?: string): Promise<DepositStatus> {
    const invoice = await this.createDeposit(amount_sats);

    // If no callback, throw with invoice details so caller can handle it
    if (!this.onPaymentNeeded) {
      throw new L402Error(
        `Payment needed: ${amount_sats} sats. ` +
        `Invoice: ${invoice.invoice}. ` +
        `No onPaymentNeeded callback configured — pay this invoice manually ` +
        `and call checkDeposit('${invoice.payment_hash}') to confirm.`,
        402,
        'PAYMENT_NEEDED'
      );
    }

    // Notify the human with clear payment instructions
    const enrichedInvoice: DepositInvoice = {
      ...invoice,
      message: [
        reason
          ? `⚡ Agent needs ${amount_sats} sats: ${reason}`
          : `⚡ Agent needs ${amount_sats} sats deposited`,
        '',
        `📱 Tap to pay: ${invoice.pay_url}`,
        '',
        `Or paste this invoice into any Lightning wallet:`,
        invoice.invoice,
      ].join('\n'),
    };
    await this.onPaymentNeeded(enrichedInvoice);

    // Poll for payment
    if (this.paymentTimeoutMs === 0) {
      return { status: 'pending', amount_sats, paid_at: null };
    }

    const deadline = Date.now() + this.paymentTimeoutMs;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, this.paymentPollIntervalMs));
      const status = await this.checkDeposit(invoice.payment_hash);
      if (status.status === 'paid') return status;
      if (status.status === 'expired') {
        throw new L402Error('Deposit invoice expired before payment', 408, 'PAYMENT_EXPIRED');
      }
    }

    throw new L402Error(
      `Payment not received within ${this.paymentTimeoutMs / 1000}s. ` +
      `Invoice may still be valid — check with checkDeposit('${invoice.payment_hash}')`,
      408,
      'PAYMENT_TIMEOUT'
    );
  }

  /**
   * Ensure the agent has at least `minBalance` sats. If not, request a deposit.
   * Convenience method that checks balance first, then deposits the difference.
   *
   * @example
   * // Before accepting an offer, make sure you can pay
   * await agent.ensureBalance(500, 'Need funds for code-review contract');
   * await agent.fundContract(contractId);
   */
  async ensureBalance(minBalance: number, reason?: string): Promise<BalanceInfo> {
    const current = await this.getBalance();
    if (current.balance_sats >= minBalance) return current;

    const needed = minBalance - current.balance_sats;
    await this.deposit(needed, reason ?? `Need ${needed} more sats (have ${current.balance_sats}, need ${minBalance})`);
    return this.getBalance();
  }

  async withdraw(amount_sats?: number): Promise<WithdrawResult> {
    return this.request('POST', '/api/v1/wallet/withdraw', amount_sats ? { amount_sats } : {});
  }

  // Offers
  async createOffer(params: CreateOfferParams): Promise<Offer> {
    const { sla_minutes, dispute_window_minutes, ...rest } = params;
    return this.request('POST', '/api/v1/offers', {
      ...rest,
      terms: {
        sla_minutes: sla_minutes ?? 30,
        dispute_window_minutes: dispute_window_minutes ?? 1440,
      },
    });
  }

  async listOffers(): Promise<Offer[]> {
    const result = await this.request<{ offers: Offer[] }>('GET', '/api/v1/offers');
    return result.offers || [];
  }

  async getOffer(offerId: string): Promise<Offer> {
    return this.request('GET', `/api/v1/offers/${offerId}`);
  }

  async updateOffer(offerId: string, active: boolean): Promise<Offer> {
    return this.request('PATCH', `/api/v1/offers/${offerId}`, { active });
  }

  // Contracts
  async acceptOffer(offerId: string): Promise<Contract> {
    return this.request('POST', '/api/v1/contracts', { offer_id: offerId });
  }

  async fundContract(contractId: string): Promise<FundResult> {
    return this.request('POST', `/api/v1/contracts/${contractId}/fund`, {});
  }

  async listContracts(filters?: { role?: 'buyer' | 'seller'; status?: string }): Promise<Contract[]> {
    let path = '/api/v1/contracts';
    const params = new URLSearchParams();
    if (filters?.role) params.append('role', filters.role);
    if (filters?.status) params.append('status', filters.status);
    if (params.toString()) path += '?' + params.toString();
    const result = await this.request<{ contracts: Contract[] }>('GET', path);
    return result.contracts || [];
  }

  async getContract(contractId: string): Promise<Contract> {
    return this.request('GET', `/api/v1/contracts/${contractId}`);
  }

  // Delivery
  async submitDelivery(contractId: string, proofUrl: string, proofData?: any): Promise<Contract> {
    return this.request('POST', `/api/v1/contracts/${contractId}/deliver`, {
      proof_url: proofUrl,
      proof_data: proofData,
    });
  }

  async confirmDelivery(contractId: string): Promise<Contract> {
    return this.request('POST', `/api/v1/contracts/${contractId}/confirm`, {});
  }

  async disputeDelivery(contractId: string, reason: string, evidenceUrl?: string): Promise<Contract> {
    return this.request('POST', `/api/v1/contracts/${contractId}/dispute`, {
      reason,
      evidence_url: evidenceUrl,
    });
  }

  // Ledger
  async getLedger(limit?: number, offset?: number): Promise<{ balance_sats: number; entries: LedgerEntry[] }> {
    let path = '/api/v1/ledger';
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    if (offset) params.append('offset', String(offset));
    if (params.toString()) path += '?' + params.toString();
    return this.request('GET', path);
  }
}
